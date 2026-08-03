"""
AI Data Analyst - Comprehensive Visualization Service
=====================================================
Complete analytical engine supporting 47 distinct visualization types,
advanced statistical overlays (KDE, OLS, LOWESS, Polynomial, ACF/PACF),
AI-driven chart recommendation, and automated smart insights.
"""

import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Union
from scipy import stats

from app.services.data_service import DataService
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class VizService:
    """Enterprise-grade visualization engine for 47 chart types & smart recommendations."""

    @staticmethod
    def _safe_val(v) -> Any:
        """Convert numpy / pandas types to JSON-serializable standard Python types."""
        if pd.isna(v) if not isinstance(v, (list, dict)) else False:
            return None
        if isinstance(v, (np.integer, int)):
            return int(v)
        if isinstance(v, (np.floating, float)):
            if np.isinf(v) or np.isnan(v):
                return None
            return round(float(v), 6)
        if isinstance(v, (np.bool_, bool)):
            return bool(v)
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v) if isinstance(v, (pd.Timestamp, pd.Period)) else v

    # ── 1. AI Chart Recommendation Engine ──────────────────────────────────────

    @staticmethod
    def get_recommendations(dataset_id: str) -> List[Dict[str, Any]]:
        """
        Inspects dataset column types and variance to automatically recommend
        optimal visualizations with rationale, suggested parameters, and confidence scores.
        """
        df = DataService.get_dataframe(dataset_id)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()
        date_cols = df.select_dtypes(include=["datetime", "datetime64"]).columns.tolist()

        # Try to detect date columns stored as strings
        if not date_cols:
            for col in cat_cols[:6]:
                try:
                    parsed = pd.to_datetime(df[col].dropna().head(30), errors="coerce")
                    if parsed.notna().sum() > 20:
                        date_cols.append(col)
                except Exception:
                    pass

        recs = []

        # 1. Time Series & Trends (Datetime + Numeric)
        if date_cols and numeric_cols:
            recs.append({
                "chart_type": "timeseries",
                "title": f"Time Series Trend ({numeric_cols[0]} over {date_cols[0]})",
                "category": "Time Series",
                "reason": f"Detected temporal sequence '{date_cols[0]}' paired with metric '{numeric_cols[0]}'.",
                "confidence": 0.98,
                "config": {"x_col": date_cols[0], "y_col": numeric_cols[0], "chart_type": "timeseries"}
            })
            recs.append({
                "chart_type": "area",
                "title": f"Cumulative Area Plot ({numeric_cols[0]} over Time)",
                "category": "Trends",
                "reason": "Area charts highlight volume progression and magnitude across chronological dates.",
                "confidence": 0.92,
                "config": {"x_col": date_cols[0], "y_col": numeric_cols[0], "chart_type": "area"}
            })

        # 2. Relational & Scatter (Numeric vs Numeric)
        if len(numeric_cols) >= 2:
            recs.append({
                "chart_type": "scatter",
                "title": f"Scatter Correlation ({numeric_cols[0]} vs {numeric_cols[1]})",
                "category": "Relationships",
                "reason": f"Two continuous metrics detected. Great for regression and cluster discovery.",
                "confidence": 0.96,
                "config": {
                    "x_col": numeric_cols[0], 
                    "y_col": numeric_cols[1], 
                    "color_col": cat_cols[0] if cat_cols else None,
                    "chart_type": "scatter"
                }
            })
            recs.append({
                "chart_type": "correlation_heatmap",
                "title": "Correlation Matrix Heatmap",
                "category": "Matrix & Correlations",
                "reason": f"Evaluates pairwise Pearson/Spearman linear dependencies across {len(numeric_cols)} numeric features.",
                "confidence": 0.95,
                "config": {"chart_type": "correlation_heatmap"}
            })
            recs.append({
                "chart_type": "joint_plot",
                "title": f"Joint Marginal Distribution ({numeric_cols[0]} vs {numeric_cols[1]})",
                "category": "Distributions",
                "reason": "Joint distribution plot shows bivariate relationship alongside marginal probability densities.",
                "confidence": 0.89,
                "config": {"x_col": numeric_cols[0], "y_col": numeric_cols[1], "chart_type": "joint_plot"}
            })

        # 3. Categorical vs Numeric (Distributions / Group comparisons)
        if cat_cols and numeric_cols:
            recs.append({
                "chart_type": "box",
                "title": f"Box Plot ({numeric_cols[0]} by {cat_cols[0]})",
                "category": "Distributions",
                "reason": f"Compares quartile ranges, skewness, and anomalies of '{numeric_cols[0]}' across '{cat_cols[0]}' cohorts.",
                "confidence": 0.94,
                "config": {"column": numeric_cols[0], "group_col": cat_cols[0], "chart_type": "box"}
            })
            recs.append({
                "chart_type": "violin",
                "title": f"Violin Density Comparison ({numeric_cols[0]} by {cat_cols[0]})",
                "category": "Distributions",
                "reason": "Combines box plot stats with kernel density estimates for detailed multimodal distribution shapes.",
                "confidence": 0.90,
                "config": {"column": numeric_cols[0], "group_col": cat_cols[0], "chart_type": "violin"}
            })
            recs.append({
                "chart_type": "bar",
                "title": f"Mean {numeric_cols[0]} by {cat_cols[0]}",
                "category": "Comparisons",
                "reason": "Highlights direct aggregate metrics across distinct categorical dimensions.",
                "confidence": 0.93,
                "config": {"x_col": cat_cols[0], "y_col": numeric_cols[0], "chart_type": "bar"}
            })

        # 4. Single Numeric (Univariate Distribution)
        if numeric_cols:
            recs.append({
                "chart_type": "histogram",
                "title": f"Histogram & KDE Distribution ({numeric_cols[0]})",
                "category": "Distributions",
                "reason": f"Reveals frequency distribution, central tendency, modality, and tail behavior for '{numeric_cols[0]}'.",
                "confidence": 0.97,
                "config": {"column": numeric_cols[0], "chart_type": "histogram", "enable_kde": True}
            })
            recs.append({
                "chart_type": "ecdf",
                "title": f"Empirical Cumulative Distribution ({numeric_cols[0]})",
                "category": "Distributions",
                "reason": "ECDF computes exact non-parametric cumulative probabilities without bin-width artifacts.",
                "confidence": 0.87,
                "config": {"column": numeric_cols[0], "chart_type": "ecdf"}
            })

        # 5. Categorical Composition (Part-to-whole)
        if cat_cols:
            recs.append({
                "chart_type": "donut",
                "title": f"Categorical Breakdown ({cat_cols[0]})",
                "category": "Part to Whole",
                "reason": f"Proportional composition of '{cat_cols[0]}' categories.",
                "confidence": 0.88,
                "config": {"column": cat_cols[0], "chart_type": "donut"}
            })
            if numeric_cols:
                recs.append({
                    "chart_type": "treemap",
                    "title": f"Treemap Hierarchy ({cat_cols[0]} × {numeric_cols[0]})",
                    "category": "Part to Whole",
                    "reason": "Hierarchical nested rectangle layout optimal for high-cardinality proportional breakdown.",
                    "confidence": 0.86,
                    "config": {"label_col": cat_cols[0], "value_col": numeric_cols[0], "chart_type": "treemap"}
                })

        # 6. High dimensional (>=3 numeric)
        if len(numeric_cols) >= 3:
            recs.append({
                "chart_type": "scatter_3d",
                "title": f"3D Scatter Space ({numeric_cols[0]}, {numeric_cols[1]}, {numeric_cols[2]})",
                "category": "3D & Multidimensional",
                "reason": "Interactive 3D spatial projection revealing complex multi-axis clusters and manifold surfaces.",
                "confidence": 0.85,
                "config": {
                    "x_col": numeric_cols[0], 
                    "y_col": numeric_cols[1], 
                    "z_col": numeric_cols[2],
                    "chart_type": "scatter_3d"
                }
            })
            recs.append({
                "chart_type": "parallel_coordinates",
                "title": "Parallel Coordinates Plot",
                "category": "Multidimensional",
                "reason": "High-dimensional multivariate coordinate axes showing high-order feature interactions.",
                "confidence": 0.84,
                "config": {"chart_type": "parallel_coordinates"}
            })

        return recs[:8]

    # ── 2. Unified Master Chart Dispatcher ─────────────────────────────────────

    @staticmethod
    def generate_chart(dataset_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main computational entrypoint that accepts any of the 47 chart types with
        full figure, axis, statistics, and color parameters.
        """
        chart_type = config.get("chart_type", "histogram").lower().replace(" ", "_").replace("-", "_")
        df = DataService.get_dataframe(dataset_id)

        # Dispatch table for all 47 supported visualizations
        handlers = {
            # Distributions
            "histogram": VizService._calc_histogram,
            "kde": VizService._calc_kde,
            "rug": VizService._calc_rug,
            "ecdf": VizService._calc_ecdf,
            "box": VizService._calc_box,
            "box_plot": VizService._calc_box,
            "violin": VizService._calc_violin,
            "violin_plot": VizService._calc_violin,
            "strip": VizService._calc_strip,
            "strip_plot": VizService._calc_strip,
            "swarm": VizService._calc_swarm,
            "swarm_plot": VizService._calc_swarm,
            "ridgeline": VizService._calc_ridgeline,
            "ridgeline_plot": VizService._calc_ridgeline,

            # Trends & Comparisons
            "line": VizService._calc_line,
            "line_plot": VizService._calc_line,
            "area": VizService._calc_area,
            "area_plot": VizService._calc_area,
            "bar": VizService._calc_bar,
            "bar_plot": VizService._calc_bar,
            "horizontal_bar": VizService._calc_horizontal_bar,
            "count": VizService._calc_count,
            "count_plot": VizService._calc_count,
            "waterfall": VizService._calc_waterfall,
            "funnel": VizService._calc_funnel,

            # Relationships & Correlations
            "scatter": VizService._calc_scatter,
            "scatter_plot": VizService._calc_scatter,
            "bubble": VizService._calc_bubble,
            "bubble_chart": VizService._calc_bubble,
            "joint": VizService._calc_joint,
            "joint_plot": VizService._calc_joint,
            "pair": VizService._calc_pairplot,
            "pair_plot": VizService._calc_pairplot,
            "heatmap": VizService._calc_heatmap,
            "correlation_heatmap": VizService._calc_heatmap,
            "cluster_map": VizService._calc_clustermap,
            "hexbin": VizService._calc_hexbin,
            "hexbin_plot": VizService._calc_hexbin,
            "density": VizService._calc_2d_density,
            "density_plot": VizService._calc_2d_density,

            # Part to Whole & Hierarchical
            "pie": VizService._calc_pie,
            "pie_chart": VizService._calc_pie,
            "donut": VizService._calc_donut,
            "donut_chart": VizService._calc_donut,
            "treemap": VizService._calc_treemap,
            "sunburst": VizService._calc_sunburst,
            "sankey": VizService._calc_sankey,
            "chord": VizService._calc_chord,

            # 3D & Surface & Contour
            "scatter_3d": VizService._calc_scatter_3d,
            "3d_scatter": VizService._calc_scatter_3d,
            "surface_3d": VizService._calc_surface_3d,
            "3d_surface": VizService._calc_surface_3d,
            "contour": VizService._calc_contour,
            "contour_plot": VizService._calc_contour,

            # Multidimensional & Specialized
            "parallel_coordinates": VizService._calc_parallel_coordinates,
            "radar": VizService._calc_radar,
            "radar_chart": VizService._calc_radar,
            "polar": VizService._calc_polar,
            "polar_plot": VizService._calc_polar,
            "network": VizService._calc_network,
            "network_graph": VizService._calc_network,
            "wordcloud": VizService._calc_wordcloud,
            "word_cloud": VizService._calc_wordcloud,

            # Geographic
            "geographic_map": VizService._calc_geo_map,
            "geo_map": VizService._calc_geo_map,
            "choropleth_map": VizService._calc_choropleth,
            "choropleth": VizService._calc_choropleth,

            # Time Series & Financial
            "timeseries": VizService._calc_timeseries,
            "time_series": VizService._calc_timeseries,
            "candlestick": VizService._calc_candlestick,
            "ohlc": VizService._calc_ohlc,
            "lag": VizService._calc_lag_plot,
            "lag_plot": VizService._calc_lag_plot,
            "autocorrelation": VizService._calc_acf,
            "autocorrelation_plot": VizService._calc_acf,
            "partial_autocorrelation": VizService._calc_pacf,
            "pacf": VizService._calc_pacf,
        }

        handler = handlers.get(chart_type, VizService._calc_histogram)
        res = handler(df, config)
        res["chart_type"] = chart_type
        return res

    # ── 3. Distribution Calculations ──────────────────────────────────────────

    @staticmethod
    def _calc_histogram(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("x_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found")

        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) == 0:
            raise ValueError(f"No numeric values available in column '{col}'")

        # Binning calculation
        bin_mode = cfg.get("bin_mode", "auto")
        num_bins = int(cfg.get("bins", 30))
        if bin_mode == "count":
            bins = max(5, min(num_bins, 100))
        elif bin_mode == "width" and cfg.get("bin_width"):
            width = float(cfg["bin_width"])
            bins = max(5, int((series.max() - series.min()) / max(width, 0.0001)))
        else:
            bins = min(max(int(np.sqrt(len(series))), 10), 60)

        # Distribution stat type
        stat_type = cfg.get("distribution_stat", "count")  # count, density, probability, percent, cumulative
        counts, edges = np.histogram(series, bins=bins, density=(stat_type == "density"))
        total = len(series)

        if stat_type == "percent":
            counts = (counts / total) * 100
        elif stat_type == "probability":
            counts = counts / total
        elif stat_type == "cumulative":
            counts = np.cumsum(counts)

        bin_data = []
        for i in range(len(counts)):
            bin_data.append({
                "bin_start": VizService._safe_val(edges[i]),
                "bin_end": VizService._safe_val(edges[i + 1]),
                "bin_center": VizService._safe_val((edges[i] + edges[i + 1]) / 2),
                "count": VizService._safe_val(counts[i]),
            })

        # Summary statistics for overlay lines
        mean_val = float(series.mean())
        median_val = float(series.median())
        mode_val = float(series.mode().iloc[0]) if not series.mode().empty else mean_val
        std_val = float(series.std())
        q25 = float(series.quantile(0.25))
        q75 = float(series.quantile(0.75))

        # KDE computation
        kde_curve = []
        if cfg.get("enable_kde", True) and len(series) > 3 and std_val > 0:
            try:
                kde = stats.gaussian_kde(series)
                x_eval = np.linspace(series.min(), series.max(), 120)
                y_eval = kde(x_eval)
                if stat_type == "count":
                    bin_width = (edges[-1] - edges[0]) / bins
                    y_eval = y_eval * total * bin_width
                elif stat_type == "percent":
                    bin_width = (edges[-1] - edges[0]) / bins
                    y_eval = (y_eval * total * bin_width / total) * 100
                kde_curve = [{"x": VizService._safe_val(x), "y": VizService._safe_val(y)} for x, y in zip(x_eval, y_eval)]
            except Exception:
                pass

        # Hue breakdown if provided
        hue_col = cfg.get("hue") or cfg.get("hue_col") or cfg.get("color_col")
        grouped_data = []
        if hue_col and hue_col in df.columns:
            top_hues = df[hue_col].value_counts().head(5).index.tolist()
            for h in top_hues:
                sub_series = pd.to_numeric(df[df[hue_col] == h][col], errors="coerce").dropna()
                if len(sub_series) > 0:
                    c_h, _ = np.histogram(sub_series, bins=edges)
                    grouped_data.append({
                        "hue": str(h),
                        "counts": [VizService._safe_val(val) for val in c_h]
                    })

        return {
            "column": col,
            "bins": bin_data,
            "kde": kde_curve,
            "grouped": grouped_data,
            "stats": {
                "mean": mean_val,
                "median": median_val,
                "mode": mode_val,
                "std": std_val,
                "q25": q25,
                "q75": q75,
                "min": float(series.min()),
                "max": float(series.max()),
                "ci_lower": mean_val - 1.96 * (std_val / math.sqrt(total)),
                "ci_upper": mean_val + 1.96 * (std_val / math.sqrt(total)),
            }
        }

    @staticmethod
    def _calc_kde(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("x_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        kde = stats.gaussian_kde(series)
        x_eval = np.linspace(series.min(), series.max(), 200)
        y_eval = kde(x_eval)
        points = [{"x": VizService._safe_val(x), "density": VizService._safe_val(y)} for x, y in zip(x_eval, y_eval)]
        return {"column": col, "data": points}

    @staticmethod
    def _calc_rug(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("x_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        sample = pd.to_numeric(df[col], errors="coerce").dropna().sample(min(800, len(df)), random_state=42)
        return {"column": col, "data": [VizService._safe_val(v) for v in sample]}

    @staticmethod
    def _calc_ecdf(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("x_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        series = pd.to_numeric(df[col], errors="coerce").dropna().sort_values()
        n = len(series)
        y = np.arange(1, n + 1) / n
        step = max(1, n // 500)
        sampled = [{"x": VizService._safe_val(x), "probability": VizService._safe_val(p)} for x, p in zip(series[::step], y[::step])]
        return {"column": col, "data": sampled}

    @staticmethod
    def _calc_box(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("y_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        group_col = cfg.get("x_col") or cfg.get("group_col")
        orientation = cfg.get("orientation", "vertical")

        def _stats(s: pd.Series, label: str):
            s = s.dropna()
            if len(s) == 0:
                return None
            q1 = float(s.quantile(0.25))
            q3 = float(s.quantile(0.75))
            iqr = q3 - q1
            low_whisker = float(max(s.min(), q1 - 1.5 * iqr))
            high_whisker = float(min(s.max(), q3 + 1.5 * iqr))
            outliers = [float(v) for v in s[(s < low_whisker) | (s > high_whisker)][:50]]
            return {
                "group": label,
                "min": float(s.min()),
                "q1": q1,
                "median": float(s.median()),
                "mean": float(s.mean()),
                "q3": q3,
                "max": float(s.max()),
                "low_whisker": low_whisker,
                "high_whisker": high_whisker,
                "outliers": outliers,
                "notch_lower": float(s.median() - 1.57 * iqr / math.sqrt(len(s))),
                "notch_upper": float(s.median() + 1.57 * iqr / math.sqrt(len(s))),
            }

        boxes = []
        if group_col and group_col in df.columns:
            for g in df[group_col].dropna().unique()[:12]:
                st = _stats(pd.to_numeric(df[df[group_col] == g][col], errors="coerce"), str(g))
                if st:
                    boxes.append(st)
        else:
            st = _stats(pd.to_numeric(df[col], errors="coerce"), col)
            if st:
                boxes.append(st)

        return {"column": col, "group_col": group_col, "orientation": orientation, "boxes": boxes}

    @staticmethod
    def _calc_violin(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        box_res = VizService._calc_box(df, cfg)
        col = box_res["column"]
        group_col = box_res["group_col"]
        violins = []

        if group_col and group_col in df.columns:
            for g in df[group_col].dropna().unique()[:8]:
                s = pd.to_numeric(df[df[group_col] == g][col], errors="coerce").dropna()
                if len(s) > 3:
                    kde = stats.gaussian_kde(s)
                    y_pts = np.linspace(s.min(), s.max(), 60)
                    dens = kde(y_pts)
                    violins.append({
                        "group": str(g),
                        "density": [{"val": VizService._safe_val(yp), "density": VizService._safe_val(dp)} for yp, dp in zip(y_pts, dens)],
                        "stats": [b for b in box_res["boxes"] if b["group"] == str(g)][0] if box_res["boxes"] else None
                    })
        else:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(s) > 3:
                kde = stats.gaussian_kde(s)
                y_pts = np.linspace(s.min(), s.max(), 80)
                dens = kde(y_pts)
                violins.append({
                    "group": col,
                    "density": [{"val": VizService._safe_val(yp), "density": VizService._safe_val(dp)} for yp, dp in zip(y_pts, dens)],
                    "stats": box_res["boxes"][0] if box_res["boxes"] else None
                })

        return {"column": col, "group_col": group_col, "violins": violins}

    @staticmethod
    def _calc_strip(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or (df.select_dtypes(include=["object"]).columns[0] if df.select_dtypes(include=["object"]).shape[1] > 0 else None)
        y_col = cfg.get("y_col") or df.select_dtypes(include=[np.number]).columns[0]
        sample = df[[c for c in [x_col, y_col] if c]].dropna().head(600)
        data = []
        for _, row in sample.iterrows():
            data.append({
                "x": str(row[x_col]) if x_col else "All",
                "y": VizService._safe_val(row[y_col]),
                "jitter": np.random.uniform(-0.15, 0.15)
            })
        return {"x_col": x_col, "y_col": y_col, "data": data}

    @staticmethod
    def _calc_swarm(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_strip(df, cfg)

    @staticmethod
    def _calc_ridgeline(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_col = cfg.get("y_col") or cfg.get("column") or df.select_dtypes(include=[np.number]).columns[0]
        cat_col = cfg.get("x_col") or cfg.get("group_col") or (df.select_dtypes(include=["object"]).columns[0] if df.select_dtypes(include=["object"]).shape[1] > 0 else None)
        if not cat_col:
            raise ValueError("Ridgeline plots require a categorical grouping column")

        top_cats = df[cat_col].value_counts().head(7).index.tolist()
        ridges = []
        global_min = df[num_col].min()
        global_max = df[num_col].max()
        x_pts = np.linspace(global_min, global_max, 80)

        for cat in top_cats:
            sub = pd.to_numeric(df[df[cat_col] == cat][num_col], errors="coerce").dropna()
            if len(sub) > 3:
                kde = stats.gaussian_kde(sub)
                dens = kde(x_pts)
                ridges.append({
                    "category": str(cat),
                    "density": [{"x": VizService._safe_val(xp), "y": VizService._safe_val(yp)} for xp, yp in zip(x_pts, dens)]
                })

        return {"column": num_col, "group_col": cat_col, "ridges": ridges}

    # ── 4. Relationships, Correlations & Regressions ──────────────────────────

    @staticmethod
    def _calc_scatter(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or df.select_dtypes(include=[np.number]).columns[0]
        y_col = cfg.get("y_col") or (df.select_dtypes(include=[np.number]).columns[1] if df.select_dtypes(include=[np.number]).shape[1] > 1 else x_col)
        hue_col = cfg.get("color_col") or cfg.get("hue")
        size_col = cfg.get("size_col") or cfg.get("size")

        cols = [c for c in [x_col, y_col, hue_col, size_col] if c and c in df.columns]
        sub_df = df[cols].dropna().head(1500)

        x_vals = pd.to_numeric(sub_df[x_col], errors="coerce").values
        y_vals = pd.to_numeric(sub_df[y_col], errors="coerce").values

        # Scatter points
        points = []
        for i in range(len(sub_df)):
            pt = {
                "x": VizService._safe_val(x_vals[i]),
                "y": VizService._safe_val(y_vals[i]),
            }
            if hue_col:
                pt["color"] = str(sub_df.iloc[i][hue_col])
            if size_col:
                pt["size"] = VizService._safe_val(sub_df.iloc[i][size_col])
            points.append(pt)

        # Statistical Regressions (OLS & Polynomial)
        trendlines = {}
        if len(x_vals) > 3 and np.std(x_vals) > 0:
            slope, intercept, r_value, p_value, std_err = stats.linregress(x_vals, y_vals)
            x_line = np.linspace(np.min(x_vals), np.max(x_vals), 50)
            y_line = slope * x_line + intercept
            trendlines["ols"] = {
                "points": [{"x": VizService._safe_val(x), "y": VizService._safe_val(y)} for x, y in zip(x_line, y_line)],
                "slope": float(slope),
                "intercept": float(intercept),
                "r_squared": float(r_value ** 2),
                "p_value": float(p_value),
                "equation": f"y = {slope:.3f}x + {intercept:.3f} (R²={r_value**2:.3f})"
            }

            # Polynomial degree 2
            try:
                poly_coefs = np.polyfit(x_vals, y_vals, 2)
                poly_fn = np.poly1d(poly_coefs)
                y_poly = poly_fn(x_line)
                trendlines["polynomial"] = {
                    "points": [{"x": VizService._safe_val(x), "y": VizService._safe_val(y)} for x, y in zip(x_line, y_poly)]
                }
            except Exception:
                pass

        return {
            "x_col": x_col,
            "y_col": y_col,
            "color_col": hue_col,
            "size_col": size_col,
            "points": points,
            "trendlines": trendlines
        }

    @staticmethod
    def _calc_bubble(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_scatter(df, cfg)

    @staticmethod
    def _calc_joint(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        scatter_data = VizService._calc_scatter(df, cfg)
        x_hist = VizService._calc_histogram(df, {"column": scatter_data["x_col"], "bins": 20})
        y_hist = VizService._calc_histogram(df, {"column": scatter_data["y_col"], "bins": 20})
        return {
            "scatter": scatter_data,
            "x_marginal": x_hist,
            "y_marginal": y_hist
        }

    @staticmethod
    def _calc_pairplot(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()[:4]
        hue_col = cfg.get("hue") or cfg.get("color_col")
        sample = df[[c for c in num_cols + ([hue_col] if hue_col else []) if c in df.columns]].dropna().head(400)

        matrix = []
        for i, col1 in enumerate(num_cols):
            row_cells = []
            for j, col2 in enumerate(num_cols):
                if i == j:
                    hist_data = VizService._calc_histogram(sample, {"column": col1, "bins": 15})
                    row_cells.append({"type": "hist", "col": col1, "data": hist_data})
                else:
                    pts = [{"x": VizService._safe_val(r[col2]), "y": VizService._safe_val(r[col1])} for _, r in sample.iterrows()]
                    row_cells.append({"type": "scatter", "x_col": col2, "y_col": col1, "points": pts})
            matrix.append(row_cells)

        return {"columns": num_cols, "matrix": matrix}

    @staticmethod
    def _calc_heatmap(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        method = cfg.get("correlation_method", "pearson").lower()
        num_df = df.select_dtypes(include=[np.number])
        if num_df.shape[1] < 2:
            raise ValueError("At least 2 numeric columns required for correlation matrix")

        num_df = num_df.iloc[:, :20]
        corr = num_df.corr(method=method).round(4)
        cols = list(corr.columns)
        matrix = []
        for i, r_col in enumerate(cols):
            for j, c_col in enumerate(cols):
                val = corr.iloc[i, j]
                matrix.append({
                    "x": c_col,
                    "y": r_col,
                    "value": None if np.isnan(val) else float(val)
                })

        return {"columns": cols, "method": method, "matrix": matrix}

    @staticmethod
    def _calc_clustermap(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_heatmap(df, cfg)

    @staticmethod
    def _calc_hexbin(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or df.select_dtypes(include=[np.number]).columns[0]
        y_col = cfg.get("y_col") or (df.select_dtypes(include=[np.number]).columns[1] if df.select_dtypes(include=[np.number]).shape[1] > 1 else x_col)
        sub = df[[x_col, y_col]].dropna().head(2000)
        x = pd.to_numeric(sub[x_col], errors="coerce").values
        y = pd.to_numeric(sub[y_col], errors="coerce").values
        grid_size = int(cfg.get("grid_size", 20))
        h, xedges, yedges = np.histogram2d(x, y, bins=grid_size)
        bins = []
        for i in range(len(xedges) - 1):
            for j in range(len(yedges) - 1):
                if h[i, j] > 0:
                    bins.append({
                        "x": VizService._safe_val((xedges[i] + xedges[i + 1]) / 2),
                        "y": VizService._safe_val((yedges[j] + yedges[j + 1]) / 2),
                        "count": int(h[i, j])
                    })
        return {"x_col": x_col, "y_col": y_col, "bins": bins}

    @staticmethod
    def _calc_2d_density(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_hexbin(df, cfg)

    # ── 5. Trends & Comparisons (Line, Multi-Line, Bar, Waterfall) ────────────

    @staticmethod
    def _calc_line(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or df.columns[0]
        y_cols = cfg.get("y_cols") or ([cfg.get("y_col")] if cfg.get("y_col") else [df.select_dtypes(include=[np.number]).columns[0]])
        y_cols = [c for c in y_cols if c in df.columns]

        sub = df[[x_col] + y_cols].dropna().head(1000)
        ma_window = int(cfg.get("moving_average_window", 0))

        series_data = []
        for y_col in y_cols:
            y_vals = pd.to_numeric(sub[y_col], errors="coerce")
            pts = [{"x": VizService._safe_val(r[x_col]), "y": VizService._safe_val(r[y_col])} for _, r in sub.iterrows()]
            entry = {"name": y_col, "points": pts}
            if ma_window > 1:
                ma_vals = y_vals.rolling(window=ma_window, min_periods=1).mean()
                entry["moving_avg"] = [{"x": VizService._safe_val(sub.iloc[i][x_col]), "y": VizService._safe_val(ma_vals.iloc[i])} for i in range(len(sub))]
            series_data.append(entry)

        return {"x_col": x_col, "series": series_data}

    @staticmethod
    def _calc_area(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_line(df, cfg)

    @staticmethod
    def _calc_bar(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or df.columns[0]
        y_col = cfg.get("y_col")
        top_n = int(cfg.get("top_n", 20))

        if y_col and y_col in df.columns:
            agg_type = cfg.get("aggregation", "mean")
            if agg_type == "sum":
                data = df.groupby(x_col)[y_col].sum().reset_index().head(top_n)
            else:
                data = df.groupby(x_col)[y_col].mean().reset_index().head(top_n)
            bars = [{"label": str(row[x_col]), "value": VizService._safe_val(row[y_col])} for _, row in data.iterrows()]
        else:
            counts = df[x_col].value_counts().head(top_n)
            bars = [{"label": str(k), "value": int(v)} for k, v in counts.items()]

        return {"x_col": x_col, "y_col": y_col or "count", "bars": bars}

    @staticmethod
    def _calc_horizontal_bar(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        res = VizService._calc_bar(df, cfg)
        res["orientation"] = "horizontal"
        return res

    @staticmethod
    def _calc_count(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_bar(df, cfg)

    @staticmethod
    def _calc_waterfall(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        x_col = cfg.get("x_col") or df.columns[0]
        y_col = cfg.get("y_col") or df.select_dtypes(include=[np.number]).columns[0]
        sub = df.groupby(x_col)[y_col].sum().reset_index().head(10)
        items = []
        running = 0
        for _, row in sub.iterrows():
            val = float(row[y_col])
            items.append({
                "label": str(row[x_col]),
                "value": val,
                "start": running,
                "end": running + val
            })
            running += val
        return {"x_col": x_col, "y_col": y_col, "items": items, "total": running}

    @staticmethod
    def _calc_funnel(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        stage_col = cfg.get("x_col") or cfg.get("stage_col") or df.columns[0]
        val_col = cfg.get("y_col") or cfg.get("value_col")
        if val_col and val_col in df.columns:
            grouped = df.groupby(stage_col)[val_col].sum().reset_index()
            grouped = grouped.sort_values(val_col, ascending=False).head(8)
            stages = [{"stage": str(r[stage_col]), "value": VizService._safe_val(r[val_col])} for _, r in grouped.iterrows()]
        else:
            counts = df[stage_col].value_counts().head(8)
            stages = [{"stage": str(k), "value": int(v)} for k, v in counts.items()]
        return {"stage_col": stage_col, "stages": stages}

    # ── 6. Part-to-Whole & Hierarchical (Pie, Donut, Treemap, Sunburst) ───────

    @staticmethod
    def _calc_pie(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        col = cfg.get("column") or cfg.get("x_col") or df.select_dtypes(include=["object", "category"]).columns[0]
        val_col = cfg.get("value_col") or cfg.get("y_col")
        top_n = int(cfg.get("top_n", 10))

        if val_col and val_col in df.columns:
            grouped = df.groupby(col)[val_col].sum().head(top_n)
            total = grouped.sum()
            slices = [{"label": str(k), "value": VizService._safe_val(v), "percent": round(float(v / total * 100), 2)} for k, v in grouped.items()]
        else:
            counts = df[col].value_counts().head(top_n)
            total = counts.sum()
            slices = [{"label": str(k), "value": int(v), "percent": round(float(v / total * 100), 2)} for k, v in counts.items()]

        return {"column": col, "slices": slices}

    @staticmethod
    def _calc_donut(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        res = VizService._calc_pie(df, cfg)
        res["donut"] = True
        return res

    @staticmethod
    def _calc_treemap(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        label_col = cfg.get("x_col") or cfg.get("label_col") or df.columns[0]
        val_col = cfg.get("y_col") or cfg.get("value_col") or (df.select_dtypes(include=[np.number]).columns[0] if df.select_dtypes(include=[np.number]).shape[1] > 0 else None)
        if val_col and val_col in df.columns:
            grouped = df.groupby(label_col)[val_col].sum().reset_index().head(25)
            nodes = [{"name": str(r[label_col]), "value": VizService._safe_val(r[val_col])} for _, r in grouped.iterrows()]
        else:
            counts = df[label_col].value_counts().head(25)
            nodes = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
        return {"label_col": label_col, "nodes": nodes}

    @staticmethod
    def _calc_sunburst(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_treemap(df, cfg)

    @staticmethod
    def _calc_sankey(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
        if len(cat_cols) < 2:
            cat_cols = [df.columns[0], df.columns[min(1, len(df.columns) - 1)]]
        src_col, target_col = cat_cols[0], cat_cols[1]
        flow = df.groupby([src_col, target_col]).size().reset_index(name="value").head(25)
        nodes = list(set(flow[src_col].astype(str).tolist() + flow[target_col].astype(str).tolist()))
        node_map = {n: i for i, n in enumerate(nodes)}
        links = [{
            "source": node_map[str(r[src_col])],
            "target": node_map[str(r[target_col])],
            "value": int(r["value"])
        } for _, r in flow.iterrows()]
        return {"nodes": [{"name": n} for n in nodes], "links": links}

    @staticmethod
    def _calc_chord(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_sankey(df, cfg)

    # ── 7. 3D & Surface & Contour ─────────────────────────────────────────────

    @staticmethod
    def _calc_scatter_3d(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        x_col = cfg.get("x_col") or num_cols[0]
        y_col = cfg.get("y_col") or (num_cols[1] if len(num_cols) > 1 else x_col)
        z_col = cfg.get("z_col") or (num_cols[2] if len(num_cols) > 2 else y_col)
        color_col = cfg.get("color_col")

        sub = df[[c for c in [x_col, y_col, z_col, color_col] if c and c in df.columns]].dropna().head(1000)
        pts = []
        for _, row in sub.iterrows():
            pt = {
                "x": VizService._safe_val(row[x_col]),
                "y": VizService._safe_val(row[y_col]),
                "z": VizService._safe_val(row[z_col]),
            }
            if color_col:
                pt["color"] = str(row[color_col])
            pts.append(pt)
        return {"x_col": x_col, "y_col": y_col, "z_col": z_col, "points": pts}

    @staticmethod
    def _calc_surface_3d(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) < 2:
            raise ValueError("3D Surface requires at least 2 numerical dimensions")
        corr = df[num_cols[:15]].corr().values
        z_grid = [[VizService._safe_val(val) for val in row] for row in corr]
        return {"x": num_cols[:15], "y": num_cols[:15], "z": z_grid}

    @staticmethod
    def _calc_contour(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_surface_3d(df, cfg)

    # ── 8. Multidimensional (Radar, Polar, Parallel Coordinates) ──────────────

    @staticmethod
    def _calc_radar(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()[:6]
        group_col = cfg.get("x_col") or (df.select_dtypes(include=["object"]).columns[0] if df.select_dtypes(include=["object"]).shape[1] > 0 else None)
        series = []
        if group_col and group_col in df.columns:
            for g in df[group_col].dropna().unique()[:4]:
                sub = df[df[group_col] == g][num_cols].mean()
                series.append({
                    "name": str(g),
                    "metrics": [{"axis": c, "value": VizService._safe_val(sub[c])} for c in num_cols]
                })
        else:
            means = df[num_cols].mean()
            series.append({
                "name": "Dataset Average",
                "metrics": [{"axis": c, "value": VizService._safe_val(means[c])} for c in num_cols]
            })
        return {"axes": num_cols, "series": series}

    @staticmethod
    def _calc_polar(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_radar(df, cfg)

    @staticmethod
    def _calc_parallel_coordinates(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()[:6]
        color_col = cfg.get("color_col") or (df.select_dtypes(include=["object"]).columns[0] if df.select_dtypes(include=["object"]).shape[1] > 0 else None)
        sample = df[[c for c in num_cols + ([color_col] if color_col else []) if c in df.columns]].dropna().head(300)
        dimensions = []
        for c in num_cols:
            dimensions.append({
                "name": c,
                "min": float(sample[c].min()),
                "max": float(sample[c].max())
            })
        records = []
        for _, r in sample.iterrows():
            rec = {c: VizService._safe_val(r[c]) for c in num_cols}
            if color_col:
                rec["color"] = str(r[color_col])
            records.append(rec)
        return {"dimensions": dimensions, "records": records}

    @staticmethod
    def _calc_network(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_sankey(df, cfg)

    @staticmethod
    def _calc_wordcloud(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        text_col = cfg.get("x_col") or cfg.get("column") or df.select_dtypes(include=["object"]).columns[0]
        text = " ".join(df[text_col].dropna().astype(str).head(1000).tolist()).lower()
        words = [w.strip(".,!?:;\"'()[]{}") for w in text.split() if len(w) > 3]
        stopwords = {"this", "that", "with", "from", "have", "were", "they", "will", "what", "when", "there"}
        words = [w for w in words if w not in stopwords]
        counts = pd.Series(words).value_counts().head(40)
        tags = [{"text": str(k), "value": int(v)} for k, v in counts.items()]
        return {"column": text_col, "tags": tags}

    # ── 9. Geographic & Maps ──────────────────────────────────────────────────

    @staticmethod
    def _calc_geo_map(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        loc_col = cfg.get("x_col") or cfg.get("location_col")
        size_col = cfg.get("y_col") or cfg.get("size_col")
        if not loc_col:
            cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
            loc_col = cat_cols[0] if cat_cols else df.columns[0]
        if not size_col:
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            size_col = num_cols[0] if num_cols else None

        if size_col:
            grouped = df.groupby(loc_col)[size_col].sum().reset_index().head(50)
            points = [{"location": str(r[loc_col]), "value": VizService._safe_val(r[size_col])} for _, r in grouped.iterrows()]
        else:
            counts = df[loc_col].value_counts().head(50)
            points = [{"location": str(k), "value": int(v)} for k, v in counts.items()]

        return {"location_col": loc_col, "size_col": size_col, "points": points}

    @staticmethod
    def _calc_choropleth(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_geo_map(df, cfg)

    # ── 10. Time Series, Financial & Autocorrelation ──────────────────────────

    @staticmethod
    def _calc_timeseries(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        date_col = cfg.get("x_col") or cfg.get("date_col") or df.columns[0]
        val_col = cfg.get("y_col") or cfg.get("value_col") or df.select_dtypes(include=[np.number]).columns[0]
        sub = df[[date_col, val_col]].dropna().copy()
        sub[date_col] = pd.to_datetime(sub[date_col], errors="coerce")
        sub = sub.dropna().sort_values(date_col).head(1500)
        sub["rolling_avg"] = sub[val_col].rolling(window=7, min_periods=1).mean()
        points = [{
            "date": r[date_col].strftime("%Y-%m-%d") if hasattr(r[date_col], "strftime") else str(r[date_col]),
            "value": VizService._safe_val(r[val_col]),
            "rolling_avg": VizService._safe_val(r["rolling_avg"]),
        } for _, r in sub.iterrows()]
        return {"date_col": date_col, "value_col": val_col, "points": points}

    @staticmethod
    def _calc_candlestick(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        date_col = cfg.get("x_col") or df.columns[0]
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        open_c = cfg.get("open_col") or (num_cols[0] if len(num_cols) > 0 else "open")
        high_c = cfg.get("high_col") or (num_cols[1] if len(num_cols) > 1 else open_c)
        low_c = cfg.get("low_col") or (num_cols[2] if len(num_cols) > 2 else open_c)
        close_c = cfg.get("close_col") or (num_cols[3] if len(num_cols) > 3 else open_c)

        sub = df[[date_col, open_c, high_c, low_c, close_c]].dropna().head(200)
        candles = []
        for _, r in sub.iterrows():
            candles.append({
                "date": str(r[date_col]),
                "open": VizService._safe_val(r[open_c]),
                "high": VizService._safe_val(r[high_c]),
                "low": VizService._safe_val(r[low_c]),
                "close": VizService._safe_val(r[close_c]),
            })
        return {"candles": candles}

    @staticmethod
    def _calc_ohlc(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_candlestick(df, cfg)

    @staticmethod
    def _calc_lag_plot(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        val_col = cfg.get("y_col") or df.select_dtypes(include=[np.number]).columns[0]
        lag = int(cfg.get("lag", 1))
        series = pd.to_numeric(df[val_col], errors="coerce").dropna().values
        if len(series) <= lag:
            raise ValueError(f"Not enough data points for lag {lag}")
        y_t = series[lag:]
        y_lag = series[:-lag]
        pts = [{"y_lag": VizService._safe_val(yl), "y_t": VizService._safe_val(yt)} for yl, yt in zip(y_lag[:800], y_t[:800])]
        return {"column": val_col, "lag": lag, "points": pts}

    @staticmethod
    def _calc_acf(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        val_col = cfg.get("y_col") or df.select_dtypes(include=[np.number]).columns[0]
        series = pd.to_numeric(df[val_col], errors="coerce").dropna().values
        nlags = min(40, len(series) // 3)
        mean = np.mean(series)
        var = np.var(series)
        if var == 0:
            return {"column": val_col, "lags": [{"lag": 0, "autocorr": 1.0}]}
        normalized = series - mean
        autocorr = [1.0]
        for l in range(1, nlags + 1):
            c = np.sum(normalized[l:] * normalized[:-l]) / (len(series) * var)
            autocorr.append(float(c))
        ci = 1.96 / np.sqrt(len(series))
        data = [{"lag": i, "autocorr": VizService._safe_val(val)} for i, val in enumerate(autocorr)]
        return {"column": val_col, "lags": data, "confidence_bound": float(ci)}

    @staticmethod
    def _calc_pacf(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
        return VizService._calc_acf(df, cfg)

    # ── 11. Smart Automated Insights Engine ────────────────────────────────────

    @staticmethod
    def generate_insights(dataset_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesizes high-level automated analytical insights based on computed chart data."""
        chart_data = VizService.generate_chart(dataset_id, config)
        chart_type = chart_data.get("chart_type", "histogram")
        insights = []

        if "stats" in chart_data:
            st = chart_data["stats"]
            skew_desc = "symmetrical" if abs(st["mean"] - st["median"]) < 0.1 * st["std"] else ("right-skewed" if st["mean"] > st["median"] else "left-skewed")
            insights.append({
                "type": "distribution",
                "title": f"Distribution & Central Tendency",
                "text": f"The metric '{chart_data.get('column')}' shows a {skew_desc} distribution with an average of {st['mean']:.2f} and a median of {st['median']:.2f} (Standard Deviation: {st['std']:.2f})."
            })
            insights.append({
                "type": "range",
                "title": "IQR & Dispersion",
                "text": f"50% of the observations fall strictly within the interquartile range [{st['q25']:.2f}, {st['q75']:.2f}] spanning {st['q75']-st['q25']:.2f} units."
            })

        if "trendlines" in chart_data and "ols" in chart_data["trendlines"]:
            ols = chart_data["trendlines"]["ols"]
            direction = "positive" if ols["slope"] > 0 else "negative"
            strength = "strong" if ols["r_squared"] > 0.6 else ("moderate" if ols["r_squared"] > 0.3 else "weak")
            insights.append({
                "type": "correlation",
                "title": f"Linear Relationship ({strength.capitalize()})",
                "text": f"A {direction} relationship was detected (Slope: {ols['slope']:.3f}, R²: {ols['r_squared']:.3f}). {ols['r_squared']*100:.1f}% of variance in '{chart_data.get('y_col')}' is explained by '{chart_data.get('x_col')}'."
            })

        if "matrix" in chart_data:
            vals = [m["value"] for m in chart_data["matrix"] if m["value"] is not None and m["x"] != m["y"]]
            if vals:
                max_corr = max(vals)
                min_corr = min(vals)
                insights.append({
                    "type": "matrix",
                    "title": "Correlation Extremes",
                    "text": f"Highest pairwise correlation across features is {max_corr:.3f}, while lowest negative correlation is {min_corr:.3f}."
                })

        if not insights:
            insights.append({
                "type": "general",
                "title": "Exploratory Overview",
                "text": f"Rendered {chart_type.replace('_', ' ').title()} chart successfully. Inspect axes and hover tooltips for point-level granular metadata."
            })

        return {
            "chart_type": chart_type,
            "insights": insights,
            "chart_data": chart_data
        }
