"""
AI Data Analyst - Feature Engineering Router & Service
=========================================================
Endpoints for feature scaling, polynomial features,
feature selection, PCA, and dimensionality reduction.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.decomposition import PCA
from sklearn.feature_selection import SelectKBest, f_classif, f_regression, VarianceThreshold

from app.services.data_service import DataService
from app.utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class PCARequest(BaseModel):
    n_components: int = 2
    columns: Optional[List[str]] = None


class PolynomialRequest(BaseModel):
    columns: List[str]
    degree: int = 2
    interaction_only: bool = False


class SelectionRequest(BaseModel):
    target_column: str
    k: int = 10
    problem_type: str = "regression"  # regression | classification


class ApplyFeatureRequest(BaseModel):
    feature_type: str  # date | ratio
    params: Dict[str, Any]


@router.post("/features/{dataset_id}/pca", summary="PCA Dimensionality Reduction")
def run_pca(dataset_id: str, req: PCARequest):
    """Apply PCA and return explained variance and transformed data preview."""
    try:
        df = DataService.get_dataframe(dataset_id)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        target_cols = [c for c in (req.columns or numeric_cols) if c in numeric_cols]

        if len(target_cols) < req.n_components:
            raise ValueError(f"n_components ({req.n_components}) > number of features ({len(target_cols)})")

        X = df[target_cols].dropna()
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        n_comp = min(req.n_components, len(target_cols))
        pca = PCA(n_components=n_comp)
        X_pca = pca.fit_transform(X_scaled)

        return {
            "n_components": n_comp,
            "explained_variance_ratio": [round(float(v), 4) for v in pca.explained_variance_ratio_],
            "cumulative_variance": [round(float(v), 4) for v in np.cumsum(pca.explained_variance_ratio_)],
            "feature_loadings": {
                f"PC{i + 1}": {col: round(float(pca.components_[i][j]), 4) for j, col in enumerate(target_cols)}
                for i in range(n_comp)
            },
            "preview": [{"PC1": float(row[0]), "PC2": float(row[1]) if n_comp > 1 else None} for row in X_pca[:100]],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/features/{dataset_id}/polynomial", summary="Polynomial Features")
def polynomial_features(dataset_id: str, req: PolynomialRequest):
    """Generate polynomial and interaction features."""
    try:
        df = DataService.get_dataframe(dataset_id).copy()
        cols = [c for c in req.columns if c in df.columns]
        if not cols:
            raise ValueError("No valid columns specified")

        X = df[cols].dropna()
        poly = PolynomialFeatures(degree=req.degree, interaction_only=req.interaction_only, include_bias=False)
        X_poly = poly.fit_transform(X)
        feature_names = poly.get_feature_names_out(cols)

        # Add new features to the dataset
        poly_df = pd.DataFrame(X_poly, columns=feature_names, index=X.index)
        new_cols = [n for n in feature_names if n not in df.columns]
        df = pd.concat([df, poly_df[new_cols]], axis=1)
        DataService.update_dataframe(dataset_id, df)

        # Log action to ledger
        DataService.log_action(dataset_id, "fe_polynomial", {
            "columns": cols,
            "degree": req.degree,
            "interaction_only": req.interaction_only,
            "new_features": new_cols
        })

        return {
            "original_features": cols,
            "new_features": new_cols,
            "total_new_features": len(new_cols),
            "degree": req.degree,
            "shape": list(df.shape),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/features/{dataset_id}/select", summary="Feature Selection")
def feature_selection(dataset_id: str, req: SelectionRequest):
    """Select top K most important features using statistical tests."""
    try:
        df = DataService.get_dataframe(dataset_id)
        if req.target_column not in df.columns:
            raise ValueError(f"Target column '{req.target_column}' not found")

        numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c != req.target_column]
        X = df[numeric_cols].dropna(axis=0)
        y = df.loc[X.index, req.target_column].dropna()
        common_idx = X.index.intersection(y.index)
        X, y = X.loc[common_idx], y.loc[common_idx]

        k = min(req.k, len(numeric_cols))
        scorer = f_classif if req.problem_type == "classification" else f_regression
        selector = SelectKBest(scorer, k=k)
        selector.fit(X, y)

        scores = [{"feature": col, "score": round(float(s), 4), "p_value": round(float(p), 6), "selected": bool(sel)}
                  for col, s, p, sel in zip(numeric_cols, selector.scores_, selector.pvalues_, selector.get_support())]
        scores.sort(key=lambda x: x["score"], reverse=True)

        return {
            "target_column": req.target_column,
            "k_best": k,
            "problem_type": req.problem_type,
            "selected_features": [s["feature"] for s in scores if s["selected"]],
            "all_scores": scores,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/features/{dataset_id}/variance-threshold")
def variance_threshold(dataset_id: str, threshold: float = 0.01):
    """Remove low-variance features."""
    try:
        df = DataService.get_dataframe(dataset_id).copy()
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        X = df[numeric_cols].dropna()
        selector = VarianceThreshold(threshold=threshold)
        selector.fit(X)
        kept = [col for col, supported in zip(numeric_cols, selector.get_support()) if supported]
        removed = [col for col in numeric_cols if col not in kept]
        return {"threshold": threshold, "kept_features": kept, "removed_features": removed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{dataset_id}/suggested", summary="Suggest Features")
def suggest_features(dataset_id: str):
    """Detect columns and suggest feature engineering transformations."""
    try:
        df = DataService.get_dataframe(dataset_id)
        suggestions = []
        
        # 1. Date columns
        for col in df.columns:
            col_series = df[col]
            is_date = False
            if pd.api.types.is_datetime64_any_dtype(col_series.dtype):
                is_date = True
            elif col_series.dtype == "object":
                sample = col_series.dropna().head(10)
                if len(sample) > 0:
                    try:
                        pd.to_datetime(sample)
                        is_date = True
                    except (ValueError, TypeError):
                        pass
            
            if is_date:
                suggestions.append({
                    "id": f"date_{col}",
                    "type": "date",
                    "column": col,
                    "title": f"Date features from '{col}'",
                    "description": f"Extract Year, Month, Day, and Day of Week columns from '{col}'."
                })
                
        # 2. Ratio/interactions suggestions
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for c1 in numeric_cols:
            for c2 in numeric_cols:
                if c1 == c2:
                    continue
                c1_lower, c2_lower = c1.lower(), c2.lower()
                if ("total" in c1_lower or "amount" in c1_lower or "price" in c1_lower) and ("quantity" in c2_lower or "count" in c2_lower or "volume" in c2_lower):
                    suggestions.append({
                        "id": f"ratio_{c1}_{c2}",
                        "type": "ratio",
                        "column1": c1,
                        "column2": c2,
                        "title": f"Ratio: '{c1}' / '{c2}'",
                        "description": f"Create a derived feature representing '{c1}' divided by '{c2}'."
                    })
                    
        return suggestions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/features/{dataset_id}/apply-suggested", summary="Apply Suggested Feature")
def apply_suggested_feature(dataset_id: str, req: ApplyFeatureRequest):
    """Apply a suggested feature engineering transformation and update the dataset."""
    try:
        df = DataService.get_dataframe(dataset_id).copy()
        p = req.params
        new_cols = []
        
        if req.feature_type == "date":
            col = p["column"]
            df[col] = pd.to_datetime(df[col], errors="coerce")
            df[f"{col}_year"] = df[col].dt.year
            df[f"{col}_month"] = df[col].dt.month
            df[f"{col}_day"] = df[col].dt.day
            df[f"{col}_dayofweek"] = df[col].dt.dayofweek
            
            new_cols = [f"{col}_year", f"{col}_month", f"{col}_day", f"{col}_dayofweek"]
            for nc in new_cols:
                df[nc] = df[nc].fillna(df[nc].median() if not df[nc].empty else 0)
                
            DataService.update_dataframe(dataset_id, df)
            
            # Log action to ledger
            DataService.log_action(dataset_id, "fe_date", {
                "column": col,
                "new_features": new_cols
            })
            
        elif req.feature_type == "ratio":
            c1 = p["column1"]
            c2 = p["column2"]
            new_col_name = f"{c1}_per_{c2}"
            df[new_col_name] = df[c1] / df[c2].replace(0, np.nan)
            df[new_col_name] = df[new_col_name].fillna(0)
            
            new_cols = [new_col_name]
            DataService.update_dataframe(dataset_id, df)
            
            # Log action
            DataService.log_action(dataset_id, "fe_ratio", {
                "column1": c1,
                "column2": c2,
                "new_feature": new_col_name
            })
            
        return {
            "status": "success",
            "new_features": new_cols,
            "shape": list(df.shape)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
