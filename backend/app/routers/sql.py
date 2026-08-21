"""
AI Data Analyst - SQL Workplace Router
========================================
Endpoints for executing SQL queries on in-memory datasets and generating suggestions.
"""

import os
import sqlite3
import pandas as pd
from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db, UserRecord, DatasetRecord
from app.services.data_service import DataService
from app.routers.auth_deps import get_current_user
from app.utils.logger import setup_logger
from app.config import settings

router = APIRouter()
logger = setup_logger(__name__)


def _validate_dataset_id(dataset_id: str, current_user: UserRecord, db: Session) -> DatasetRecord:
    if not dataset_id or dataset_id.strip() == "" or dataset_id.lower() == "undefined":
        raise HTTPException(status_code=400, detail="Invalid dataset ID provided.")
    
    record = db.query(DatasetRecord).filter(
        DatasetRecord.id == dataset_id,
        DatasetRecord.user_id == current_user.id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found or access denied.")
    
    return record


class SQLExecuteRequest(BaseModel):
    query: str
    apply_select_results: Optional[bool] = False


@router.post("/sql/{dataset_id}/execute", summary="Execute SQL Query on Dataset")
def execute_sql(
    dataset_id: str,
    req: SQLExecuteRequest,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
):
    """
    Execute any SQLite query on the active dataset.
    Modifying queries (UPDATE, DELETE, ALTER, INSERT) will directly modify the dataset.
    SELECT queries will only return a preview, unless apply_select_results is True.
    """
    _validate_dataset_id(dataset_id, current_user, db)
    
    query_str = req.query.strip()
    if not query_str:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty.")
    
    try:
        # Get dataframe
        df = DataService.get_dataframe(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {str(e)}")

    # Setup transient in-memory SQLite connection
    conn = sqlite3.connect(":memory:")
    
    try:
        # Load the DataFrame to the database
        df.to_sql("dataset", conn, index=False)
        
        # Check if the query is a SELECT/WITH (non-modifying)
        query_lower = query_str.lower()
        is_select = query_lower.startswith(("select", "with", "explain", "pragma"))
        
        if is_select:
            # Run SELECT query
            result_df = pd.read_sql_query(query_str, conn)
            
            if req.apply_select_results:
                # Apply the select results directly as the new dataset state
                DataService.update_dataframe(dataset_id, result_df)
                DataService.log_action(dataset_id, "sql_query_select_applied", {
                    "query": query_str,
                    "rows_affected": len(result_df)
                })
                
                # Update DB record rows/columns count
                record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
                if record:
                    record.rows = len(result_df)
                    record.columns = len(result_df.columns)
                    db.commit()
                
                return {
                    "success": True,
                    "is_select": True,
                    "applied": True,
                    "columns": list(result_df.columns),
                    "rows_count": len(result_df),
                    "preview": result_df.head(100).to_dict(orient="records"),
                    "message": f"Query executed. Dataset preprocessed and updated to query results ({len(result_df)} rows, {len(result_df.columns)} columns)."
                }
            else:
                return {
                    "success": True,
                    "is_select": True,
                    "applied": False,
                    "columns": list(result_df.columns),
                    "rows_count": len(result_df),
                    "preview": result_df.head(100).to_dict(orient="records"),
                    "message": f"Query executed successfully, returning {len(result_df)} rows."
                }
        else:
            # Modifying query (UPDATE, DELETE, ALTER, INSERT, etc.)
            cursor = conn.cursor()
            if ";" in query_str:
                cursor.executescript(query_str)
            else:
                cursor.execute(query_str)
            conn.commit()
            
            # Read updated table back
            try:
                updated_df = pd.read_sql_query("SELECT * FROM dataset", conn)
            except Exception:
                raise ValueError("The 'dataset' table was dropped or renamed. Please ensure the 'dataset' table exists after execution.")
            
            # Apply changes to the main dataset cache
            DataService.update_dataframe(dataset_id, updated_df)
            DataService.log_action(dataset_id, "sql_query_modified", {
                "query": query_str,
                "rows_affected": len(updated_df)
            })
            
            # Update DB record rows/columns count
            record = db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).first()
            if record:
                record.rows = len(updated_df)
                record.columns = len(updated_df.columns)
                db.commit()
                
            return {
                "success": True,
                "is_select": False,
                "applied": True,
                "columns": list(updated_df.columns),
                "rows_count": len(updated_df),
                "preview": updated_df.head(100).to_dict(orient="records"),
                "message": f"Modifying query executed successfully. Changes applied to dataset ({len(updated_df)} rows, {len(updated_df.columns)} columns)."
            }
            
    except Exception as e:
        logger.error(f"SQL execution error: {e}")
        raise HTTPException(status_code=400, detail=f"SQL Error: {str(e)}")
    finally:
        conn.close()


@router.get("/sql/{dataset_id}/suggest", summary="Suggest SQL Queries for Dataset")
def suggest_sql(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
):
    """
    Generate 3 SQL query suggestions tailored to the dataset.
    Uses Gemini AI if configured, otherwise falls back to rule-based templates.
    """
    _validate_dataset_id(dataset_id, current_user, db)
    
    try:
        df = DataService.get_dataframe(dataset_id)
        info = DataService.get_dataset_info(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset metadata: {str(e)}")

    # 1. Rule-based suggestions (fallback)
    suggestions = []
    
    # Suggestion 1: Simple preview
    suggestions.append({
        "title": "Select Preview",
        "description": "Retrieve the first 10 rows to inspect the raw structure.",
        "query": "SELECT * FROM dataset LIMIT 10;"
    })
    
    # Suggestion 2: Categorical aggregation
    cat_cols = info.get("column_types", {}).get("categorical", [])
    if cat_cols:
        suggestions.append({
            "title": "Group and Count Categories",
            "description": f"Aggregate occurrences of the categorical field '{cat_cols[0]}'.",
            "query": f"SELECT `{cat_cols[0]}`, COUNT(*) as count\nFROM dataset\nGROUP BY `{cat_cols[0]}`\nORDER BY count DESC\nLIMIT 10;"
        })
        
    # Suggestion 3: Numeric statistics summary
    num_cols = info.get("column_types", {}).get("numeric", [])
    if num_cols:
        suggestions.append({
            "title": "Calculate Statistics",
            "description": f"Calculate average, minimum, and maximum for '{num_cols[0]}'.",
            "query": f"SELECT AVG(`{num_cols[0]}`) as avg_val,\n       MIN(`{num_cols[0]}`) as min_val,\n       MAX(`{num_cols[0]}`) as max_val\nFROM dataset;"
        })
    else:
        # Fallback if no numeric columns
        suggestions.append({
            "title": "Row Count Summary",
            "description": "Get total count of records in the dataset.",
            "query": "SELECT COUNT(*) as total_rows FROM dataset;"
        })

    # 2. Gemini-powered suggestions if key is present
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            import json
            
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            # Simple context snippet
            schema_context = f"Columns: {', '.join(df.columns.tolist())}\n"
            schema_context += "Numeric Columns: " + ", ".join(num_cols[:5]) + "\n"
            schema_context += "Categorical Columns: " + ", ".join(cat_cols[:5]) + "\n"
            
            prompt = f"""You are an expert SQL engineer. Generate 3 interesting and useful SQL queries tailored to this dataset schema:
{schema_context}

The table name is always 'dataset'. 

Format your response as a JSON array of objects, where each object has these keys:
- "title": A short name for the query.
- "description": A short explanation of the query's business value.
- "query": The exact SQL query (SQLite syntax) to run on table 'dataset'. Remember to wrap columns containing spaces in backticks or double quotes.

Return ONLY valid JSON, no markdown codeblocks."""

            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Strip code blocks if AI returned them
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()
                
            gemini_suggestions = json.loads(text)
            if isinstance(gemini_suggestions, list) and len(gemini_suggestions) > 0:
                return {
                    "suggestions": gemini_suggestions,
                    "engine": "gemini"
                }
        except Exception as e:
            logger.warning(f"Failed to generate Gemini SQL suggestions: {e}. Falling back to rules.")
            
    return {
        "suggestions": suggestions,
        "engine": "rule-based"
    }
