"""
AI Data Analyst - AI Insights Service
========================================
Provides intelligent, natural-language insights about datasets.
Uses rule-based analysis by default, with optional Gemini AI integration
when an API key is provided.
"""

import ast
import io
import re
import threading
import contextlib
import traceback

# pyrefly: ignore [missing-import]
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

from app.services.data_service import DataService
from app.services.eda_service import EDAService
from app.config import settings
from app.utils.cache import analysis_cache
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class AIService:
    """
    AI-powered insights service.
    Generates executive summaries, recommendations, and answers NL queries.
    """

    # ── Helper: normalize a DataFrame for sandbox runs ────────────────────────

    @staticmethod
    def _sample_df(df: pd.DataFrame) -> pd.DataFrame:
        """Return a bounded sample of the dataset for sandbox execution."""
        sample = df.head(500).copy()
        if sample.empty:
            sample = df.copy()
        return sample

    # ── Main Entry Points ─────────────────────────────────────────────────────

    @staticmethod
    def generate_auto_insights(dataset_id: str) -> Dict[str, Any]:
        """
        Generate comprehensive AI insights automatically after upload.
        Falls back to rule-based if Gemini API key is not configured.
        """
        cache_key = f"{dataset_id}:ai:auto_insights"
        cached = analysis_cache.get(cache_key)
        if cached:
            return cached

        df = DataService.get_dataframe(dataset_id)
        info = DataService.get_dataset_info(dataset_id)

        # Build context summary for LLM
        context = AIService._build_context(df, info)

        # Try Gemini first, fall back to rule-based
        if settings.GEMINI_API_KEY:
            try:
                result = AIService._gemini_insights(context, df, info)
                analysis_cache.set(cache_key, result)
                return result
            except Exception as e:
                logger.warning(f"Gemini API failed, using rule-based: {e}")

        result = AIService._rule_based_insights(df, info)
        analysis_cache.set(cache_key, result)
        return result

    @staticmethod
    def answer_question(dataset_id: str, question: str) -> Dict[str, Any]:
        """
        Answer a natural language question about the dataset.
        If the user asks for code related to dataset operations, the code is
        EXECUTED against the real dataset and the live computed results are
        returned in the response.
        """
        df = DataService.get_dataframe(dataset_id)
        info = DataService.get_dataset_info(dataset_id)
        context = AIService._build_context(df, info)

        # Detect code-generation intent and execute the code on real data
        if AIService._is_code_request(question):
            if settings.GEMINI_API_KEY:
                try:
                    return AIService._gemini_code_answer(context, question, df)
                except Exception as e:
                    logger.warning(f"Gemini code answer failed, using rule-based: {e}")
            return AIService._rule_based_code_answer_with_execution(question, df, info)

        if settings.GEMINI_API_KEY:
            try:
                return AIService._gemini_answer(context, question, df)
            except Exception as e:
                logger.warning(f"Gemini answer failed, using rule-based: {e}")

        return AIService._rule_based_answer(question, df, info)

    # ── Code Request Detection ──────────────────────────────────────────────────

    _CODE_INTENT_KEYWORDS = [
        "code", "script", "python", "pandas", "snippet", "write", "function",
        "implement", "how to", "how do i", "give me code", "generate code",
        "show code", "example",
    ]

    # Substrings that indicate the request is NOT about dataset operations
    _OUT_OF_SCOPE_KEYWORDS = [
        "delete file", "remove file", "rm ", "shutdown", "reboot", "os.system",
        "subprocess", "exec(", "eval(", "format drive", "malware", "ransomware",
        "keylogger", "credential", "password hack", "hack", "crack", "exploit",
        "ddos", "phishing", "spam", "scrape website", "bypass", "rootkit",
        "reverse shell", "browser history", "steal", "vpn", "proxy", "torrent",
    ]

    @staticmethod
    def _is_code_request(question: str) -> bool:
        """Determine whether the user is asking for code."""
        q_lower = question.lower()

        # Explicit out-of-scope requests are still treated as code requests
        # so they can be refused with the restriction message.
        if any(k in q_lower for k in AIService._OUT_OF_SCOPE_KEYWORDS):
            return True

        return any(k in q_lower for k in AIService._CODE_INTENT_KEYWORDS)

    @staticmethod
    def _refuse_out_of_scope(question: str) -> Dict[str, Any]:
        """Return a polite refusal for out-of-scope code requests."""
        return {
            "source": "guardrail",
            "question": question,
            "answer": (
                "I can only generate code for operations on the dataset you've uploaded — "
                "loading, cleaning, exploration, visualization, feature engineering, and ML "
                "modeling using pandas, numpy, matplotlib, seaborn, and scikit-learn. "
                "The request you made falls outside that scope, so I can't provide code for it. "
                "Try asking something like \"Write pandas code to handle missing values\" or "
                "\"Give me code for a correlation heatmap\"."
            ),
            "explanation": "Code generation is restricted to dataset operations for safety and compliance.",
            "suggestions": [
                "Write pandas code to handle missing values",
                "Give me code for outlier detection",
                "Show me code to train a Random Forest model",
            ],
        }

    @staticmethod
    def generate_data_dictionary(dataset_id: str) -> Dict[str, Any]:
        """Generate an automatic data dictionary / column descriptions."""
        df = DataService.get_dataframe(dataset_id)

        columns = []
        for col in df.columns:
            series = df[col].dropna()
            dtype = str(df[col].dtype)
            col_type = DataService._classify_column(col, df[col])

            # Build description
            desc = AIService._describe_column(col, series, col_type)

            columns.append({
                "name": col,
                "dtype": dtype,
                "type_category": col_type,
                "description": desc,
                "missing_count": int(df[col].isnull().sum()),
                "missing_pct": round(df[col].isnull().sum() / len(df) * 100, 2),
                "unique_count": int(df[col].nunique()),
                "sample_values": DataService._safe_sample_values(df[col]),
                "statistics": AIService._column_stats(series, col_type),
            })

        return {
            "dataset_name": "Dataset",
            "total_columns": len(columns),
            "columns": columns,
        }

    # ── Context Builder ────────────────────────────────────────────────────────

    @staticmethod
    def _build_context(df: pd.DataFrame, info: Dict[str, Any]) -> str:
        """Build a text context string for the LLM prompt."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        context = f"""
Dataset Overview:
- Shape: {info['rows']:,} rows × {info['columns']} columns
- Memory: {info['memory_usage_mb']} MB
- Missing values: {info['missing_values_total']:,} ({info.get('completeness_score', 0):.1f}% complete)
- Duplicate rows: {info['duplicate_rows']:,}
- Numeric columns ({len(numeric_cols)}): {', '.join(numeric_cols[:10])}
- Categorical columns ({len(cat_cols)}): {', '.join(cat_cols[:10])}

Numeric Summary:
"""
        for col in numeric_cols[:8]:
            series = df[col].dropna()
            if len(series) > 0:
                context += f"  {col}: mean={series.mean():.2f}, std={series.std():.2f}, min={series.min():.2f}, max={series.max():.2f}\n"

        context += "\nCategorical Summary:\n"
        for col in cat_cols[:5]:
            top = df[col].value_counts().head(3)
            context += f"  {col}: {', '.join([f'{k}({v})' for k, v in top.items()])}\n"

        return context

    # ── Gemini AI Integration ──────────────────────────────────────────────────

    @staticmethod
    def _gemini_insights(context: str, df: pd.DataFrame, info: Dict[str, Any]) -> Dict[str, Any]:
        """Use Gemini API to generate insights."""
        # pyrefly: ignore [missing-import]
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""You are a senior data scientist and business analyst. Analyze this dataset and provide:

{context}

Please provide:
1. Executive Summary (3-4 sentences about the dataset)
2. Key Findings (5 bullet points)
3. Data Quality Issues (problems found)
4. Business Recommendations (3-5 actionable recommendations)
5. ML Readiness Assessment (is data ready for ML? What model would you recommend?)
6. Risk Factors (potential issues or biases)

Format as structured JSON with keys: executive_summary, key_findings, data_quality_issues, recommendations, ml_readiness, risk_factors.
Only return valid JSON, no markdown."""

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Parse JSON response
        import json
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        parsed = json.loads(text)
        parsed["source"] = "gemini-ai"
        return parsed

    @staticmethod
    def _gemini_answer(context: str, question: str, df: pd.DataFrame) -> Dict[str, Any]:
        """Use Gemini to answer a specific question about the dataset."""
        # pyrefly: ignore [missing-import]
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""You are a helpful, advanced AI assistant (similar to ChatGPT or Gemini AI) with access to the user's dataset.

Dataset Context:
{context}

Question: {question}

Instructions:
1. Provide a comprehensive, detailed, and clear answer.
2. You can answer any general user questions (including general knowledge, coding, writing, mathematics, etc.). If the question relates to the dataset context above, utilize the context to provide specific insights.
3. CRITICAL SECURITY GUARDRAILS: Do NOT disclose or generate API keys, passwords, credentials, system keys, secrets, or private personal information (PII) under any circumstances. If the user asks for passwords, credentials, keys, or private info, politely refuse to answer.

Format your response as JSON with keys: answer, explanation, suggestions (list of follow-up questions).
Only return valid JSON."""

        response = model.generate_content(prompt)
        text = response.text.strip()

        import json
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        parsed = json.loads(text)
        parsed["source"] = "gemini-ai"
        parsed["question"] = question
        return parsed

    @staticmethod
    def _gemini_code_answer(context: str, question: str, df: pd.DataFrame) -> Dict[str, Any]:
        """Use Gemini to generate Python code for dataset operations, then execute it on the real dataset."""
        # pyrefly: ignore [missing-import]
        import google.generativeai as genai

        # Guardrail: block out-of-scope code requests
        if any(k in question.lower() for k in AIService._OUT_OF_SCOPE_KEYWORDS):
            return AIService._refuse_out_of_scope(question)

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""You are a Python data science expert and general coding assistant. Based on the following dataset context, write working Python code for the user's request.

Dataset Context:
{context}

Request: {question}

IMPORTANT: The code will be EXECUTED against the real dataset in a sandbox if it is a dataset operation. Write code that:
- Assumes the dataset is loaded in a DataFrame named `df` if operating on the dataset.
- Only prints results (do NOT open files, do NOT write files, do NOT call plt.show() for sandbox runs).
- Uses print() statements to output the actual computed values.
- Is safe and uses standard Python libraries.

CRITICAL SECURITY GUARDRAILS: Do NOT generate, display, or disclose API keys, passwords, credentials, secrets, system files access, or private personal information (PII) under any circumstances. If the user asks for keys, credentials, passwords, or private info, write a simple print statement explaining that you are not allowed to access or generate sensitive information.

Respond ONLY with valid JSON using these keys:
- "code": the complete Python code block as a string (no markdown fences, just raw code)
- "language": "python"
- "explanation": a short plain-text explanation of what the code does (no markdown)
- "suggestions": a JSON array of 2-3 follow-up question strings

Example response:
{{"code": "print(df.shape)\\nprint(df.describe())", "language": "python", "explanation": "Preview the dataset.", "suggestions": ["Show column stats"]}}"""

        response = model.generate_content(prompt)
        text = response.text.strip()

        import json
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        parsed = json.loads(text)
        parsed["source"] = "gemini-ai"
        parsed["question"] = question

        # Execute the generated code on the real dataset
        exec_result = AIService._execute_code(parsed.get("code", ""), df)

        parsed["execution_output"] = exec_result["output"]
        parsed["sample_preview"] = exec_result["sample_preview"]
        parsed["execution_ok"] = exec_result["ok"]
        parsed["code_errors"] = [exec_result["error"]] if exec_result["error"] else []
        parsed["code_fixed"] = AIService._auto_fix_code(parsed.get("code", ""), df) if exec_result["error"] else None

        if exec_result["ok"]:
            if exec_result["output"]:
                parsed["answer"] = (
                    "I ran the generated code on your actual dataset. Here is the live output:\n\n"
                    f"{exec_result['output']}\n\n{parsed.get('explanation', '')}"
                )
            else:
                parsed["answer"] = f"Here is the Python code to {question.strip().rstrip('?').lower()}."
        else:
            parsed["answer"] = AIService._format_code_debug_message(
                [exec_result["error"]] if exec_result["error"] else [], question
            )

        return parsed

    # ── Generated Code Debugging & Execution ──────────────────────────────────

    _CODE_DEBUG_TIMEOUT = 15  # seconds

    _SAFE_BUILTIN_NAMES = frozenset({
        "abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter",
        "float", "format", "frozenset", "int", "isinstance", "issubclass", "len",
        "list", "map", "max", "min", "pow", "print", "range", "repr", "reversed",
        "round", "set", "slice", "sorted", "str", "sum", "tuple", "type", "zip",
        "hash", "id", "iter", "next", "object", "False", "None", "True",
    })

    _SAFE_IMPORT_MODULES = (
        "pandas", "numpy", "matplotlib", "seaborn", "sklearn",
        "scipy", "warnings", "math",
    )

    @staticmethod
    def _safe_import(name: str, *args, **kwargs):
        """Allow only whitelisted analysis libraries in sandboxed dry-runs."""
        if name.startswith(AIService._SAFE_IMPORT_MODULES):
            return __import__(name, *args, **kwargs)
        raise ImportError(f"Import of '{name}' is not allowed for generated analysis code.")

    @staticmethod
    def _debug_generated_code(code: str, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Run static + sandboxed checks on generated code and return a list of issues."""
        if not code or not code.strip():
            return [{
                "type": "EmptyResponse",
                "message": "No code was generated, so it could not be validated.",
                "line": None,
                "solution": "Try rephrasing the question to be more specific about the dataset operation.",
            }]

        errors: List[Dict[str, Any]] = AIService._static_code_checks(code, df)

        runtime_result = AIService._run_sandbox(code, df)
        if runtime_result.get("ok") is False and runtime_result.get("error"):
            errors.append(runtime_result["error"])

        # De-duplicate identical issues reported by both static and runtime checks
        unique: List[Dict[str, Any]] = []
        seen = set()
        for err in errors:
            key = (err.get("type"), err.get("message"))
            if key not in seen:
                seen.add(key)
                unique.append(err)
        return unique

    @staticmethod
    def _static_code_checks(code: str, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """AST-based checks for syntax errors, undefined names, and bad column references."""
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return [{
                "type": "SyntaxError",
                "message": str(e.msg or e),
                "line": getattr(e, "lineno", None),
                "solution": (
                    "Fix the syntax error on this line. Common causes: missing colons, "
                    "mismatched parentheses/brackets, or unescaped quotes in strings."
                ),
            }]

        if df.empty or len(df.columns) == 0:
            return []

        actual_cols = {str(c) for c in df.columns}
        errors: List[Dict[str, Any]] = []

        # 1) Undefined variable references (NameError)
        defined = {n for n in AIService._SAFE_BUILTIN_NAMES} | {"df", "pd", "np", "plt", "sns"}
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                defined.add(node.id)
            elif isinstance(node, ast.arg):
                defined.add(node.arg)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                defined.add(node.name)
            elif isinstance(node, ast.ExceptHandler) and node.name:
                defined.add(node.name)
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    defined.add(alias.asname or alias.name.split(".")[0])

        seen_names = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                if node.id not in defined and node.id not in seen_names:
                    seen_names.add(node.id)
                    errors.append({
                        "type": "NameError",
                        "message": f"Variable '{node.id}' is used but never defined.",
                        "line": getattr(node, "lineno", None),
                        "solution": (
                            f"Define '{node.id}' before using it, or replace it with an actual "
                            f"column from your dataset: {', '.join(list(actual_cols)[:6])}"
                        ),
                    })

        # 2) Column references that do not exist in the dataset
        column_refs: List[Dict[str, Any]] = []
        for node in ast.walk(tree):
            # df['missing_col']
            if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name) and node.value.id == "df":
                if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):
                    column_refs.append({"col": node.slice.value, "line": getattr(node, "lineno", None)})
            # df.drop(columns=['a', 'b']) / df.drop(columns='a')
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "drop":
                for kw in node.keywords:
                    if kw.arg == "columns":
                        if isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                            column_refs.append({"col": kw.value.value, "line": getattr(node, "lineno", None)})
                        elif isinstance(kw.value, (ast.List, ast.Tuple)):
                            for elt in kw.value.elts:
                                if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                    column_refs.append({"col": elt.value, "line": getattr(elt, "lineno", None)})
            # df.groupby('col') / df.sort_values('col')
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in ("groupby", "sort_values", "merge"):
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    column_refs.append({"col": node.args[0].value, "line": getattr(node, "lineno", None)})

        reported_cols = set()
        for ref in column_refs:
            col = ref["col"]
            if col not in actual_cols and col not in reported_cols:
                reported_cols.add(col)
                errors.append({
                    "type": "KeyError",
                    "message": f"Column '{col}' does not exist in the dataset.",
                    "line": ref["line"],
                    "solution": (
                        f"This code references a column that isn't in your data. "
                        f"Available columns: {', '.join(list(actual_cols)[:8])}. "
                        f"Replace '{col}' with one of these."
                    ),
                })

        # 3) Reading a CSV/Excel from disk — the dataset is already loaded as `df`
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and node.func.attr in ("read_csv", "read_excel")
                    and isinstance(node.func.value, ast.Name) and node.func.value.id == "pd"):
                errors.append({
                    "type": "FileNotFoundError",
                    "message": "The code tries to load a CSV/Excel from a hard-coded file path, which won't exist in the running environment.",
                    "line": getattr(node, "lineno", None),
                    "solution": (
                        "Remove the load line — the dataset is already available as the DataFrame `df`. "
                        "Continue with `df` directly."
                    ),
                })

        return errors

    @staticmethod
    def _run_sandbox(code: str, df: pd.DataFrame) -> Dict[str, Any]:
        """Execute generated code against the real dataset and capture both errors and printed output.

        Returns a dict with:
          - ok: bool
          - error: dict | None  (single error object, same shape as before)
          - output: str  (captured stdout/stderr from the run)
        """
        import builtins as _builtins

        sample = AIService._sample_df(df)

        safe_builtins = {
            name: getattr(_builtins, name)
            for name in AIService._SAFE_BUILTIN_NAMES
            if hasattr(_builtins, name)
        }
        safe_builtins["__import__"] = AIService._safe_import
        safe_builtins["__name__"] = "__main__"
        # Explicitly remove potentially dangerous builtins
        for name in ("open", "eval", "exec", "compile", "input", "exit", "quit", "help", "breakpoint"):
            safe_builtins.pop(name, None)

        # pyrefly: ignore [missing-import]
        import matplotlib
        previous_backend = matplotlib.get_backend()
        matplotlib.use("Agg", force=True)

        # pyrefly: ignore [missing-import]
        import numpy as np
        import pandas as pd
        import seaborn as sns
        # pyrefly: ignore [missing-import]
        import matplotlib.pyplot as plt

        sandbox_globals = {
            "__builtins__": safe_builtins,
            "df": sample,
            "pd": pd,
            "np": np,
            "plt": plt,
            "sns": sns,
        }

        # Patch loaders so placeholder file paths resolve to the real dataset
        original_read_csv = pd.read_csv
        original_read_excel = pd.read_excel
        pd.read_csv = lambda *a, **k: sample
        pd.read_excel = lambda *a, **k: sample

        output = io.StringIO()
        holder: Dict[str, Any] = {}

        def _target():
            try:
                compiled = compile(code, "<generated>", "exec")
                with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                    exec(compiled, sandbox_globals)
                holder["ok"] = True
            except BaseException as exc:
                holder["ok"] = False
                holder["error"] = exc
                holder["tb"] = traceback.format_exc()

        worker = threading.Thread(target=_target, daemon=True)
        worker.start()
        worker.join(AIService._CODE_DEBUG_TIMEOUT)

        # Restore patched module state regardless of outcome
        pd.read_csv = original_read_csv
        pd.read_excel = original_read_excel
        try:
            matplotlib.use(previous_backend, force=True)
        except Exception:
            pass

        # Wait a tiny bit so the StringIO flush completes before we read it
        import time as _time
        _time.sleep(0.05)
        captured_output = output.getvalue().strip()

        if worker.is_alive():
            return {
                "ok": False,
                "error": {
                    "type": "TimeoutError",
                    "message": "The code did not finish within the validation window — it may contain an infinite loop or an overly heavy operation.",
                    "line": None,
                    "solution": (
                        "Check for loops that never break and avoid training on the full dataset; "
                        "sample the data first (e.g. `df.sample(1000)`) for quick experiments."
                    ),
                },
                "output": captured_output,
            }

        if not holder.get("ok"):
            exc = holder.get("error")
            if exc is None:
                return {
                    "ok": False,
                    "error": {
                        "type": "RuntimeError",
                        "message": "The code failed during execution but no error details were captured.",
                        "line": None,
                        "solution": "Try running the code locally to inspect the failure, then re-ask the question.",
                    },
                    "output": captured_output,
                }

            # Locate the line in the generated source where the failure happened
            line_no = None
            tb_obj = exc.__traceback__
            while tb_obj is not None:
                frame = getattr(tb_obj, "tb_frame", None)
                if frame is not None and getattr(frame, "f_code", None) is not None and frame.f_code.co_filename == "<generated>":
                    line_no = tb_obj.tb_lineno
                tb_obj = tb_obj.tb_next

            message = str(exc).strip() or "Unknown runtime error"
            solution = AIService._suggest_solution(exc, line_no, code, df)
            return {
                "ok": False,
                "error": {
                    "type": type(exc).__name__,
                    "message": message,
                    "line": line_no,
                    "solution": solution,
                },
                "output": captured_output,
            }

        return {"ok": True, "error": None, "output": captured_output}

    @staticmethod
    def _execute_code(code: str, df: pd.DataFrame) -> Dict[str, Any]:
        """Run generated code on the real dataset and return the live output + any error.

        Returns:
          {"ok": bool, "output": str, "error": dict|None, "sample_preview": str|None}
        """
        result = AIService._run_sandbox(code, df)

        # Fallback sample preview when the code prints nothing useful
        sample_preview = None
        if result.get("ok") and not result.get("output"):
            preview_rows = df.head(5).to_string(index=False)
            sample_preview = f"Row preview of your dataset (first 5 rows):\n{preview_rows}"

        return {
            "ok": bool(result.get("ok")),
            "output": result.get("output", ""),
            "error": result.get("error"),
            "sample_preview": sample_preview,
        }

    @staticmethod
    def _suggest_solution(exc: BaseException, line_no: Optional[int], code: str, df: pd.DataFrame) -> str:
        """Build a targeted, actionable fix suggestion for a runtime error."""
        exc_name = type(exc).__name__
        message = str(exc)

        if exc_name == "KeyError":
            cols = ", ".join(list(df.columns)[:8])
            return (
                f"The referenced label doesn't exist in the data. Use a real column name "
                f"(available: {cols}). If this is the ML target, pick the column you want to predict."
            )

        if exc_name == "NameError":
            return (
                "A variable is used before it is defined. Define it earlier in the script, "
                "or replace the placeholder name with an actual column from the dataset."
            )

        if exc_name == "IndexError":
            return (
                "The code tried to access an element that doesn't exist (e.g. `.mode()[0]` on an "
                "empty series). Check for empty groups/columns and guard with `not col.empty`."
            )

        if exc_name in ("ValueError", "TypeError") and (
            "could not convert string to float" in message.lower()
            or "cannot convert" in message.lower()
        ):
            return (
                "The code is treating text as a number. Use `pd.to_numeric(df[col], errors='coerce')` "
                "or inspect the column's dtype first with `df.dtypes`."
            )

        if exc_name == "AttributeError":
            return (
                "The method used does not exist on that object. Check the pandas/sklearn API — "
                "for columns use `df[['col']]`, and verify method names like `drop_duplicates` or `fit_transform`."
            )

        if exc_name == "ImportError":
            return "The code imports a library that is not installed or not allowed. Stick to pandas, numpy, matplotlib, seaborn, sklearn, and scipy."

        return (
            "Review the highlighted line and break the operation into smaller steps. "
            "Add a `print(df.dtypes)` / `print(df.head())` before it to inspect the data state, "
            "then re-run after fixing the issue."
        )

    @staticmethod
    def _pick_target_column(df: pd.DataFrame) -> Optional[str]:
        """Choose a sensible default target column for auto-fixes."""
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        for col in cat_cols:
            n_unique = df[col].nunique()
            if 2 <= n_unique <= 12:
                return col
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        non_id = [
            c for c in numeric_cols
            if str(c).lower() not in ("id", "index", "row_id", "record_id")
            and not str(c).lower().startswith("unnamed")
        ]
        return non_id[0] if non_id else (numeric_cols[0] if numeric_cols else None)

    @staticmethod
    def _auto_fix_code(code: str, df: pd.DataFrame) -> Optional[str]:
        """Apply safe, deterministic fixes to generated code. Returns None if nothing changed."""
        fixed = code
        target_holders = ("target_col", "your_target", "y_label", "target")
        candidate = AIService._pick_target_column(df)
        if candidate:
            for holder in target_holders:
                fixed = fixed.replace(f"'{holder}'", f"'{candidate}'")

        # Replace hard-coded loaders with the already-loaded DataFrame
        fixed = re.sub(
            r"df\s*=\s*pd\.read_csv\([^)]*\)",
            "df = df.copy()  # dataset is already loaded",
            fixed,
        )
        fixed = re.sub(
            r"df\s*=\s*pd\.read_excel\([^)]*\)",
            "df = df.copy()  # dataset is already loaded",
            fixed,
        )

        return fixed if fixed != code else None

    @staticmethod
    def _format_code_debug_message(errors: List[Dict[str, Any]], question: str) -> str:
        """Build a readable summary of validation issues found in generated code."""
        lines = [
            "I validated the generated code against your dataset and found "
            f"{len(errors)} problem(s) to fix:"
        ]
        for i, err in enumerate(errors, 1):
            loc = f" (line {err.get('line')})" if err.get("line") else ""
            lines.append(f"{i}. {err.get('type', 'Error')}{loc}: {err.get('message', '')}")
            lines.append(f"   Fix: {err.get('solution', 'Review and adjust the code.')}")
        lines.append("Apply the fixes above and I can regenerate the corrected version for you.")
        return "\n".join(lines)

    # ── Rule-Based Insights ────────────────────────────────────────────────────

    @staticmethod
    def _rule_based_insights(df: pd.DataFrame, info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate rule-based insights without an LLM."""
        rows, cols = df.shape
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        datetime_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
        missing_pct = info.get("completeness_score", 100)
        dup_pct = info.get("duplicate_percentage", 0)

        # Executive Summary
        exec_summary = (
            f"The dataset contains {rows:,} rows and {cols} columns with "
            f"{len(numeric_cols)} numeric and {len(cat_cols)} categorical features. "
            f"Data completeness is {missing_pct:.1f}%, "
            f"{'which is excellent' if missing_pct >= 95 else 'indicating some missing data to address'}. "
            f"{'There are duplicate rows that should be reviewed. ' if dup_pct > 0 else ''}"
            f"{'Time-series analysis is possible given datetime columns.' if datetime_cols else ''}"
        )

        # Key Findings
        key_findings = []
        if numeric_cols:
            top_col = numeric_cols[0]
            series = df[top_col].dropna()
            key_findings.append(f"'{top_col}' has a mean of {series.mean():.2f} and std of {series.std():.2f}")

        if dup_pct > 0:
            key_findings.append(f"{dup_pct:.1f}% of rows are duplicates ({info['duplicate_rows']:,} rows)")

        if info["missing_values_total"] > 0:
            key_findings.append(f"{info['missing_values_total']:,} missing values found across {info['missing_columns']} columns")

        if cat_cols:
            col = cat_cols[0]
            n_unique = df[col].nunique()
            key_findings.append(f"'{col}' has {n_unique} unique categories")

        for col in numeric_cols[:3]:
            skew_val = df[col].skew()
            if not pd.isna(skew_val) and abs(float(skew_val)) > 2:
                key_findings.append(f"'{col}' is highly skewed (skewness={float(skew_val):.2f}) — consider transformation")

        # Data Quality Issues
        dq_issues = []
        if missing_pct < 95:
            dq_issues.append(f"Missing values: {100 - missing_pct:.1f}% of data is incomplete")
        if dup_pct > 0:
            dq_issues.append(f"Duplicate rows: {info['duplicate_rows']:,} duplicates found")
        for col in numeric_cols[:5]:
            if df[col].nunique() == 1:
                dq_issues.append(f"Constant column: '{col}' has only one unique value")

        # Recommendations
        recommendations = []
        if info["missing_values_total"] > 0:
            recommendations.append("Handle missing values using mean/median imputation for numeric columns and mode for categoricals")
        if dup_pct > 0:
            recommendations.append("Remove duplicate rows to prevent data leakage in ML models")
        if len(numeric_cols) > 0:
            high_skew_cols = []
            for c in numeric_cols:
                s = df[c].skew()
                if not pd.isna(s) and abs(float(s)) > 2:
                    high_skew_cols.append(c)
            if high_skew_cols:
                recommendations.append(f"Apply log transformation to skewed columns: {', '.join(high_skew_cols[:3])}")
        if cat_cols:
            recommendations.append("Encode categorical variables using appropriate encoding strategies before ML")
        recommendations.append("Split data into train/test sets (80/20) before any ML modeling")

        # ML Readiness
        score = 100
        ml_notes = []
        if rows < 100:
            score -= 40; ml_notes.append("Very small dataset")
        elif rows < 1000:
            score -= 10; ml_notes.append("Small dataset — use cross-validation")
        if missing_pct < 80:
            score -= 20; ml_notes.append("Too many missing values")
        if len(numeric_cols) < 2:
            score -= 20; ml_notes.append("Very few numeric features")

        suggested_models = []
        if rows > 1000 and len(numeric_cols) >= 3:
            suggested_models = ["Random Forest", "XGBoost", "Gradient Boosting"]
        elif rows > 100:
            suggested_models = ["Logistic Regression", "Decision Tree", "KNN"]

        ml_readiness = {
            "score": max(0, score),
            "grade": "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D",
            "is_ready": score >= 60,
            "notes": ml_notes,
            "suggested_models": suggested_models,
        }

        # Risk Factors
        risk_factors = []
        if dup_pct > 5:
            risk_factors.append("High duplicate rate may indicate data collection issues")
        if missing_pct < 70:
            risk_factors.append("Very high missing data rate — model reliability may be compromised")
        if rows < 500:
            risk_factors.append("Small sample size increases risk of overfitting")
        if len(cat_cols) > len(numeric_cols) * 2:
            risk_factors.append("Many categorical columns — ensure proper encoding to avoid dimensionality explosion")

        return {
            "source": "rule-based",
            "executive_summary": exec_summary,
            "key_findings": key_findings[:7],
            "data_quality_issues": dq_issues if dq_issues else ["No major data quality issues detected"],
            "recommendations": recommendations[:6],
            "ml_readiness": ml_readiness,
            "risk_factors": risk_factors if risk_factors else ["No significant risk factors identified"],
        }

    @staticmethod
    def _rule_based_answer(question: str, df: pd.DataFrame, info: Dict[str, Any]) -> Dict[str, Any]:
        """Answer common questions about the dataset using rule-based logic."""
        q_lower = question.lower()

        answer = ""
        suggestions = []

        if any(k in q_lower for k in ["missing", "null", "na"]):
            total_missing = info["missing_values_total"]
            answer = f"The dataset has {total_missing:,} missing values across {info['missing_columns']} columns. "
            if total_missing > 0:
                worst = sorted(info["missing_info"].items(), key=lambda x: x[1]["count"], reverse=True)[:3]
                answer += "Most affected columns: " + ", ".join([f"{c} ({v['percentage']:.1f}%)" for c, v in worst])
            suggestions = ["How should I handle missing values?", "Which columns have the most missing data?"]

        elif any(k in q_lower for k in ["duplicate", "repeat"]):
            dup = info["duplicate_rows"]
            answer = f"There are {dup:,} duplicate rows ({info['duplicate_percentage']:.1f}% of the dataset)."
            suggestions = ["How do I remove duplicates?", "What causes duplicate rows?"]

        elif any(k in q_lower for k in ["correlation", "correlated", "related"]):
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if len(numeric_cols) >= 2:
                corr = df[numeric_cols].corr().abs()
                np.fill_diagonal(corr.values, 0)
                max_corr_idx = corr.unstack().idxmax()
                max_corr_val = corr.unstack().max()
                answer = f"The highest correlation is between '{max_corr_idx[0]}' and '{max_corr_idx[1]}' (r={max_corr_val:.3f})."
            else:
                answer = "Not enough numeric columns to compute correlations."
            suggestions = ["Show the correlation heatmap", "Which features should I drop due to high correlation?"]

        elif any(k in q_lower for k in ["target", "predict", "label", "dependent", "classification", "regression"]):
            # Suggest target column candidates
            categorical_targets = []
            for c in df.select_dtypes(include=["object", "category"]).columns:
                n_unique = df[c].nunique()
                if 2 <= n_unique <= 12:
                    categorical_targets.append(c)
            
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            non_id_numeric = [
                c for c in numeric_cols
                if str(c).lower() not in ("id", "index", "row_id", "record_id")
                and not str(c).lower().startswith("unnamed")
            ]
            
            if categorical_targets:
                answer = (
                    f"For Machine Learning, I recommend using a column with clear classification labels as the target. "
                    f"Based on your dataset, the best categorical target candidates are: "
                    f"{', '.join([f'\'{c}\' ({df[c].nunique()} classes)' for c in categorical_targets[:3]])}. "
                )
                if non_id_numeric:
                    answer += f"If you want to perform regression (predicting a quantity), you could predict: {', '.join([f'\'{c}\'' for c in non_id_numeric[:2]])}."
            elif non_id_numeric:
                answer = (
                    f"For Machine Learning, I recommend predicting a numeric column (regression). "
                    f"Based on your dataset, suitable target columns include: {', '.join([f'\'{c}\'' for c in non_id_numeric[:3]])}."
                )
            else:
                answer = "I couldn't identify any obvious target columns. Please check if your dataset contains valid features."
                
            suggestions = ["What ML model should I train?", "Show details about my columns"]

        elif any(k in q_lower for k in ["model", "algorithm", "machine learning", "ml"]):
            rows = info["rows"]
            answer = f"Based on your dataset ({rows:,} rows), I recommend: "
            if rows > 5000:
                answer += "Random Forest, XGBoost, or Gradient Boosting for best performance."
            elif rows > 500:
                answer += "Random Forest or Logistic Regression as reliable choices."
            else:
                answer += "Decision Tree or KNN due to the small sample size."
            suggestions = ["What is the target variable?", "Run automated model comparison"]

        elif any(k in q_lower for k in ["rows", "size", "shape", "large"]):
            answer = f"The dataset has {info['rows']:,} rows and {info['columns']} columns ({info['memory_usage_mb']} MB in memory)."
            suggestions = ["Show dataset preview", "What are the column types?"]

        elif any(k in q_lower for k in ["column", "feature", "variable"]):
            answer = f"The dataset has {info['columns']} columns: "
            num_count = len(info["column_types"]["numeric"])
            cat_count = len(info["column_types"]["categorical"])
            answer += f"{num_count} numeric and {cat_count} categorical features."
            suggestions = ["Show column statistics", "Which columns should be removed?"]

        else:
            # Check if they are asking for keys/passwords in general query
            if any(k in q_lower for k in ["api key", "password", "credential", "secret", "private info"]):
                answer = "For safety and security, I cannot access, display, or generate passwords, API keys, credentials, or private user information."
                suggestions = ["What are the column names?", "Summarize the dataset"]
            else:
                answer = (
                    f"I am currently running in rule-based fallback mode. To enable fully advanced chat access like ChatGPT or Gemini AI (allowing you to ask any general question or run sandboxed python computations), please configure your 'GEMINI_API_KEY' in the Railway settings dashboard.\n\n"
                    f"In this mode, I can help you with specific dataset queries: try asking about missing values, duplicate rows, correlations, or ML targets!"
                )
                suggestions = [
                    "Suggest target column for ML",
                    "Which columns have missing data?",
                    "What are the most important insights?",
                ]

        return {
            "source": "rule-based",
            "question": question,
            "answer": answer,
            "explanation": "This answer is generated using rule-based analysis of your dataset statistics.",
            "suggestions": suggestions,
        }

    # ── Rule-Based Code Answers (execute-and-report) ───────────────────────────

    @staticmethod
    def _pick_and_generate_code(question: str, df: pd.DataFrame):
        """Select the most relevant pre-built, print-only template for the question.

        Returns (code, explanation, suggestions). The code is designed to be
        executed in the sandbox against the real dataset and print live results.
        """
        q_lower = question.lower()

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        # ── Load / preview ────────────────────────────────────────────────────
        if any(k in q_lower for k in ["load", "read", "preview", "head", "view", "import"]):
            code = """print("Shape:", df.shape)
print("\\nColumns:", list(df.columns))
print("\\nData types:\\n", df.dtypes)
print("\\nMissing values:\\n", df.isnull().sum())
print("\\nFirst 5 rows:\\n", df.head().to_string())"""
            explanation = "Loads the dataset and provides a quick structural overview."
            suggestions = ["Write code to handle missing values", "Write code to remove duplicates"]

        # ── Missing values ───────────────────────────────────────────────────
        elif any(k in q_lower for k in ["missing", "null", "impute", "fillna", "na"]):
            code = """missing = df.isnull().sum()
missing_pct = (missing / len(df) * 100).round(2)
info = pd.DataFrame({'missing_count': missing, 'missing_pct': missing_pct})
print(info[info['missing_count'] > 0])"""
            explanation = "Detects missing values and reports counts + percentages per column."
            suggestions = ["Write code to remove duplicates", "Write code to detect outliers"]

        # ── Duplicates ───────────────────────────────────────────────────────
        elif any(k in q_lower for k in ["duplicate", "repeat", "drop_duplicates"]):
            code = """dup_count = df.duplicated().sum()
dup_pct = (dup_count / len(df) * 100).round(2)
print(f"Duplicate rows: {dup_count} ({dup_pct}% of dataset)")
print(f"Total rows: {len(df)}")"""
            explanation = "Identifies and removes duplicate rows, optionally based on specific columns."
            suggestions = ["Write code to handle missing values", "Write code for outlier detection"]

        # ── Correlations ─────────────────────────────────────────────────────
        elif any(k in q_lower for k in ["correlation", "corr", "heatmap", "related"]):
            code = """corr = df.corr(numeric_only=True)
if corr.empty:
    print("No numeric columns to correlate.")
else:
    corr_unstacked = corr.abs().unstack()
    corr_unstacked = corr_unstacked[corr_unstacked.index.get_level_values(0) != corr_unstacked.index.get_level_values(1)]
    if not corr_unstacked.empty:
        top = corr_unstacked.idxmax()
        print("Correlation matrix:")
        print(corr.round(3).to_string())
        print(f"\\nHighest correlation: {top[0]} vs {top[1]} = {corr.loc[top[0], top[1]]:.3f}")"""
            explanation = "Computes the correlation matrix and identifies the highest correlated pair."
            suggestions = ["Write code to train a model", "Write code to plot distributions"]

        # ── Outliers ─────────────────────────────────────────────────────────
        elif any(k in q_lower for k in ["outlier", "z-score", "zscore", "iqr", "anomal"]):
            code = """num_cols = df.select_dtypes(include=['number']).columns
results = []
for col in num_cols:
    Q1 = df[col].quantile(0.25)
    Q3 = df[col].quantile(0.75)
    IQR = Q3 - Q1
    lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
    n_out = int(((df[col] < lower) | (df[col] > upper)).sum())
    results.append(f"{col}: {n_out} outliers")
print("\\n".join(results) if results else "No numeric columns to check.")"""
            explanation = "Detects outliers per numeric column using the IQR method."
            suggestions = ["Write code to handle missing values", "Write code to create visualizations"]

        # ── Visualizations ───────────────────────────────────────────────────
        elif any(k in q_lower for k in ["plot", "chart", "graph", "visual", "histogram", "scatter", "figure"]):
            code = """import matplotlib.pyplot as plt
num_cols = df.select_dtypes(include=['number']).columns
if len(num_cols) > 0:
    fig, axes = plt.subplots(1, min(len(num_cols), 4), figsize=(12, 3))
    axes = axes if isinstance(axes, list) or len(num_cols) > 1 else [axes]
    for ax, col in zip(axes, num_cols[:4]):
        df[col].hist(ax=ax, bins=30)
        ax.set_title(col)
    plt.tight_layout()
    print("Generated histogram for numeric columns:", list(num_cols[:4]))
else:
    print("No numeric columns to plot.")"""
            explanation = "Generates histograms for numeric columns to explore distributions."
            suggestions = ["Write code for correlation analysis", "Write code to train an ML model"]

        # ── Feature encoding / transformation ────────────────────────────────
        elif any(k in q_lower for k in ["encode", "one-hot", "onehot", "label", "categor", "transform", "scale", "normalize", "standard"]):
            code = """before = df.shape[1]
df_encoded = pd.get_dummies(df, columns=df.select_dtypes(include=['object', 'category']).columns, drop_first=True)
print(f"Columns before: {before}, after one-hot: {df_encoded.shape[1]}")
print("Categorical columns encoded:", list(df.select_dtypes(include=['object', 'category']).columns))"""
            explanation = "Encodes categorical columns (one-hot) and reports the new feature count."
            suggestions = ["Write code to train a Random Forest", "Write code to split train/test"]

        # ── ML modeling ──────────────────────────────────────────────────────
        elif any(k in q_lower for k in ["model", "train", "fit", "predict", "classif", "regress", "random forest", "xgboost", "decision tree", "split"]):
            target_candidate = None
            for c in df.select_dtypes(include=["object", "category"]).columns:
                n_unique = df[c].nunique()
                if 2 <= n_unique <= 12:
                    target_candidate = c
                    break
            if target_candidate is None:
                non_id = [
                    c for c in numeric_cols
                    if str(c).lower() not in ("id", "index", "row_id", "record_id")
                    and not str(c).lower().startswith("unnamed")
                ]
                target_candidate = non_id[0] if non_id else (numeric_cols[0] if numeric_cols else None)

            if target_candidate:
                code = f"""from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

X = pd.get_dummies(df.drop(columns=['{target_candidate}']), drop_first=True)
y = df['{target_candidate}']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y if len(y.unique()) <= 10 else None)

model = RandomForestClassifier(n_estimators=50, max_depth=None, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
print("Accuracy:", round(accuracy_score(y_test, y_pred), 4))
print("\\nClassification Report:\\n", classification_report(y_test, y_pred))
print("\\nFeature Importances:\\n", pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False).head(10))"""
                explanation = f"Trains a Random Forest to predict '{target_candidate}' and reports real accuracy + feature importances."
            else:
                code = """print("No suitable target column found for ML modeling.")"""
                explanation = "No suitable target column was found in the dataset."
            suggestions = ["Write code for outlier detection", "Write code for a correlation heatmap"]

        # ── Generic dataset operation code ───────────────────────────────────
        else:
            code = """print("Shape:", df.shape)
print("\\nColumns:", list(df.columns))
print("\\nData types:\\n", df.dtypes)
print("\\nMissing values:\\n", df.isnull().sum())
print("\\nDescriptive statistics:\\n", df.describe(include='all'))"""
            explanation = "Runs a comprehensive data exploration pass on the uploaded dataset."
            suggestions = [
                "Write code to handle missing values",
                "Write code for outlier detection",
                "Write code to train a Random Forest model",
            ]

        return code, explanation, suggestions

    @staticmethod
    def _rule_based_code_answer(question: str, df: pd.DataFrame, info: Dict[str, Any]) -> Dict[str, Any]:
        """Return pre-built, correct pandas/sklearn snippets validated against the dataset."""
        q_lower = question.lower()

        # Guardrail: block out-of-scope code requests
        if any(k in q_lower for k in AIService._OUT_OF_SCOPE_KEYWORDS):
            return AIService._refuse_out_of_scope(question)

        code, explanation, suggestions = AIService._pick_and_generate_code(question, df)

        # Validate the generated snippet against the real dataset and attach issues + fixes
        code_errors = AIService._debug_generated_code(code, df)
        code_fixed = AIService._auto_fix_code(code, df) if code_errors else None

        return {
            "source": "rule-based",
            "question": question,
            "code": code,
            "language": "python",
            "explanation": explanation,
            "suggestions": suggestions,
            "code_errors": code_errors,
            "code_fixed": code_fixed,
            "answer": (
                AIService._format_code_debug_message(code_errors, question)
                if code_errors
                else f"Here is the Python code to {question.strip().rstrip('?').lower()}."
            ),
        }

    @staticmethod
    def _rule_based_code_answer_with_execution(question: str, df: pd.DataFrame, info: Dict[str, Any]) -> Dict[str, Any]:
        """Return a code snippet AND execute it on the real dataset, so the answer includes live results."""
        q_lower = question.lower()

        # Guardrail: block out-of-scope code requests
        if any(k in q_lower for k in AIService._OUT_OF_SCOPE_KEYWORDS):
            return AIService._refuse_out_of_scope(question)

        base = AIService._rule_based_code_answer(question, df, info)
        code = base["code"]

        # Execute on the real dataset (bounded sample, print-only)
        exec_result = AIService._execute_code(code, df)

        result = dict(base)
        result["execution_output"] = exec_result["output"]
        result["sample_preview"] = exec_result["sample_preview"]
        result["execution_ok"] = exec_result["ok"]

        if exec_result["ok"] and exec_result["output"]:
            result["answer"] = (
                f"I executed this code on your actual dataset. Real results:\n\n"
                f"{exec_result['output']}\n\n{base['explanation']}"
            )
            result["code_errors"] = []
            result["code_fixed"] = None
        elif exec_result["ok"]:
            result["answer"] = base["explanation"]
            result["code_errors"] = []
            result["code_fixed"] = None
        else:
            error = exec_result["error"] or {}
            result["code_errors"] = [error]
            result["code_fixed"] = AIService._auto_fix_code(code, df)
            result["answer"] = (
                f"I attempted to run this code on your dataset, but it failed:\n"
                f"{error.get('type', 'Error')}"
                + (f" (line {error.get('line')})" if error.get("line") else "")
                + f": {error.get('message', '')}\n\n"
                f"Fix: {error.get('solution', 'Review the code.')}"
            )

        return result

    # ── Column Description ─────────────────────────────────────────────────────

    @staticmethod
    def _describe_column(col_name: str, series: pd.Series, col_type: str) -> str:
        """Generate a human-readable description for a column."""
        col_lower = col_name.lower()

        # Semantic descriptions based on name patterns
        name_hints = {
            "id": "Unique identifier for each record",
            "age": "Age of the individual in years",
            "date": "Date/timestamp of the event",
            "price": "Price or monetary value",
            "sales": "Sales quantity or revenue",
            "revenue": "Revenue generated",
            "profit": "Profit amount",
            "category": "Category or classification label",
            "name": "Name of the entity",
            "gender": "Gender of the individual",
            "country": "Country of origin or operation",
            "state": "State or region",
            "city": "City name",
            "email": "Email address",
            "phone": "Phone number",
            "rating": "Rating score",
            "score": "Computed score or metric",
            "count": "Count of occurrences",
            "quantity": "Quantity of items",
        }

        for keyword, description in name_hints.items():
            if keyword in col_lower:
                return description

        # Generic descriptions based on type
        if col_type == "numeric":
            return f"Numeric feature ranging from {series.min():.2f} to {series.max():.2f}"
        elif col_type == "categorical":
            n_unique = series.nunique()
            return f"Categorical feature with {n_unique} unique values"
        elif col_type == "datetime":
            return f"Datetime column spanning {series.min()} to {series.max()}"
        elif col_type == "id_or_text":
            return "High-cardinality text column (possibly an ID or free-text field)"
        elif col_type == "boolean":
            return "Boolean (true/false) flag"
        else:
            return f"Column of type {col_type}"

    @staticmethod
    def _column_stats(series: pd.Series, col_type: str) -> Optional[Dict[str, Any]]:
        """Compute relevant statistics for a column."""
        if col_type in ("numeric", "categorical_numeric"):
            try:
                return {
                    "mean": round(float(series.mean()), 4),
                    "median": round(float(series.median()), 4),
                    "std": round(float(series.std()), 4),
                    "min": round(float(series.min()), 4),
                    "max": round(float(series.max()), 4),
                }
            except Exception:
                return None
        elif col_type in ("categorical", "text"):
            top = series.value_counts().head(5)
            return {"top_values": {str(k): int(v) for k, v in top.items()}}
        return None