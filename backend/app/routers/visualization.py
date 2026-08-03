"""
AI Data Analyst - Comprehensive Visualization Router
=====================================================
Unified REST endpoints for all 47 chart types, automatic chart recommendations,
smart insights, and legacy individual routes.
"""

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.viz_service import VizService
from app.services.data_service import DataService
from app.utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


def _handle(action: str, dataset_id: str, params: dict, func, *args, **kwargs):
    try:
        res = func(*args, **kwargs)
        DataService.log_action(dataset_id, action, params)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        logger.error(f"Visualization Error in {action}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Visualization failed: {str(e)}")


# ── Unified Generation, Recommendation & Insights Endpoints ──────────────────

@router.post("/viz/{dataset_id}/generate")
def generate_chart(dataset_id: str, config: Dict[str, Any] = Body(...)):
    """
    Unified master endpoint to calculate and format data for any of the 47 chart types,
    including advanced distribution parameters, statistical overlays, regressions, and binning.
    """
    return _handle("viz_generate", dataset_id, config, VizService.generate_chart, dataset_id, config)


@router.get("/viz/{dataset_id}/recommendations")
def get_recommendations(dataset_id: str):
    """
    Scans dataset column data types, cardinality, and distributions to recommend
    the optimal visualizations with rationale, suggested configurations, and confidence scores.
    """
    return _handle("viz_recommendations", dataset_id, {}, VizService.get_recommendations, dataset_id)


@router.post("/viz/{dataset_id}/insights")
def generate_insights(dataset_id: str, config: Dict[str, Any] = Body(...)):
    """
    Generates automated statistical interpretations, trend commentary, and insights for any visualization.
    """
    return _handle("viz_insights", dataset_id, config, VizService.generate_insights, dataset_id, config)


# ── Individual / Legacy Endpoints ─────────────────────────────────────────────

@router.get("/viz/{dataset_id}/histogram/{column}")
def histogram(dataset_id: str, column: str, bins: int = 30):
    return _handle("viz_histogram", dataset_id, {"column": column, "bins": bins}, VizService.generate_chart, dataset_id, {"chart_type": "histogram", "column": column, "bins": bins})


@router.get("/viz/{dataset_id}/bar/{x_col}")
def bar_chart(dataset_id: str, x_col: str, y_col: Optional[str] = None, top_n: int = 20):
    return _handle("viz_bar", dataset_id, {"x_col": x_col, "y_col": y_col}, VizService.generate_chart, dataset_id, {"chart_type": "bar", "x_col": x_col, "y_col": y_col, "top_n": top_n})


@router.get("/viz/{dataset_id}/line/{x_col}/{y_col}")
def line_chart(dataset_id: str, x_col: str, y_col: str):
    return _handle("viz_line", dataset_id, {"x_col": x_col, "y_col": y_col}, VizService.generate_chart, dataset_id, {"chart_type": "line", "x_col": x_col, "y_col": y_col})


@router.get("/viz/{dataset_id}/scatter/{x_col}/{y_col}")
def scatter_plot(dataset_id: str, x_col: str, y_col: str, color_col: Optional[str] = None):
    return _handle("viz_scatter", dataset_id, {"x_col": x_col, "y_col": y_col, "color_col": color_col}, VizService.generate_chart, dataset_id, {"chart_type": "scatter", "x_col": x_col, "y_col": y_col, "color_col": color_col})


@router.get("/viz/{dataset_id}/box/{column}")
def box_plot(dataset_id: str, column: str, group_col: Optional[str] = None):
    return _handle("viz_box", dataset_id, {"column": column, "group_col": group_col}, VizService.generate_chart, dataset_id, {"chart_type": "box", "column": column, "group_col": group_col})


@router.get("/viz/{dataset_id}/pie/{column}")
def pie_chart(dataset_id: str, column: str, top_n: int = 10):
    return _handle("viz_pie", dataset_id, {"column": column}, VizService.generate_chart, dataset_id, {"chart_type": "pie", "column": column, "top_n": top_n})


@router.get("/viz/{dataset_id}/heatmap")
def correlation_heatmap(dataset_id: str):
    return _handle("viz_heatmap", dataset_id, {}, VizService.generate_chart, dataset_id, {"chart_type": "correlation_heatmap"})


@router.get("/viz/{dataset_id}/area/{x_col}/{y_col}")
def area_chart(dataset_id: str, x_col: str, y_col: str):
    return _handle("viz_area", dataset_id, {"x_col": x_col, "y_col": y_col}, VizService.generate_chart, dataset_id, {"chart_type": "area", "x_col": x_col, "y_col": y_col})


@router.get("/viz/{dataset_id}/violin/{column}")
def violin_plot(dataset_id: str, column: str, group_col: Optional[str] = None):
    return _handle("viz_violin", dataset_id, {"column": column, "group_col": group_col}, VizService.generate_chart, dataset_id, {"chart_type": "violin", "column": column, "group_col": group_col})


@router.get("/viz/{dataset_id}/count/{column}")
def count_plot(dataset_id: str, column: str, hue_col: Optional[str] = None):
    return _handle("viz_count", dataset_id, {"column": column, "hue_col": hue_col}, VizService.generate_chart, dataset_id, {"chart_type": "count", "column": column, "hue_col": hue_col})


@router.get("/viz/{dataset_id}/timeseries/{date_col}/{value_col}")
def time_series(dataset_id: str, date_col: str, value_col: str):
    return _handle("viz_timeseries", dataset_id, {"date_col": date_col, "value_col": value_col}, VizService.generate_chart, dataset_id, {"chart_type": "timeseries", "date_col": date_col, "value_col": value_col})


@router.get("/viz/{dataset_id}/bubble/{x_col}/{y_col}/{size_col}")
def bubble_chart(dataset_id: str, x_col: str, y_col: str, size_col: str, color_col: Optional[str] = None):
    return _handle("viz_bubble", dataset_id, {"x_col": x_col, "y_col": y_col, "size_col": size_col}, VizService.generate_chart, dataset_id, {"chart_type": "bubble", "x_col": x_col, "y_col": y_col, "size_col": size_col, "color_col": color_col})


@router.get("/viz/{dataset_id}/treemap/{label_col}/{value_col}")
def treemap(dataset_id: str, label_col: str, value_col: str):
    return _handle("viz_treemap", dataset_id, {"label_col": label_col, "value_col": value_col}, VizService.generate_chart, dataset_id, {"chart_type": "treemap", "label_col": label_col, "value_col": value_col})


@router.get("/viz/{dataset_id}/funnel/{stage_col}/{value_col}")
def funnel(dataset_id: str, stage_col: str, value_col: str):
    return _handle("viz_funnel", dataset_id, {"stage_col": stage_col, "value_col": value_col}, VizService.generate_chart, dataset_id, {"chart_type": "funnel", "stage_col": stage_col, "value_col": value_col})


@router.get("/viz/{dataset_id}/scatter3d/{x_col}/{y_col}/{z_col}")
def scatter_3d(dataset_id: str, x_col: str, y_col: str, z_col: str, color_col: Optional[str] = None):
    return _handle("viz_scatter_3d", dataset_id, {"x_col": x_col, "y_col": y_col, "z_col": z_col}, VizService.generate_chart, dataset_id, {"chart_type": "scatter_3d", "x_col": x_col, "y_col": y_col, "z_col": z_col, "color_col": color_col})


@router.get("/viz/{dataset_id}/pairplot")
def pair_plot(dataset_id: str, columns: Optional[str] = None, max_cols: int = 5):
    cols = columns.split(",") if columns else None
    return _handle("viz_pairplot", dataset_id, {"columns": cols}, VizService.generate_chart, dataset_id, {"chart_type": "pair_plot", "columns": cols, "max_cols": max_cols})


@router.get("/viz/{dataset_id}/bubblemap/{location_col}/{size_col}")
def bubble_map(dataset_id: str, location_col: str, size_col: str):
    return _handle("viz_bubble_map", dataset_id, {"location_col": location_col, "size_col": size_col}, VizService.generate_chart, dataset_id, {"chart_type": "geographic_map", "location_col": location_col, "size_col": size_col})
