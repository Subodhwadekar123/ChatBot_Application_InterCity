"""
AI Data Analyst - ML Router
==============================
Endpoints for machine learning model training, evaluation, tuning, and prediction.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.ml_service import MLService
from app.services.data_service import DataService
from app.utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


class TrainRequest(BaseModel):
    target_column: str
    algorithm: str
    feature_columns: Optional[List[str]] = None
    test_size: float = 0.2
    n_clusters: int = 3


class CompareRequest(BaseModel):
    target_column: str
    algorithms: List[str]
    test_size: float = 0.2


class TrainV2Request(BaseModel):
    target_column: str
    algorithm: str
    feature_columns: Optional[List[str]] = None
    test_size: float = 0.2
    scaling_method: str = "auto"
    imputation_strategy: str = "median"
    stratify_split: bool = True
    categorical_encoding: str = "onehot"
    hyperparameters: Optional[Dict[str, Any]] = None
    n_clusters: int = 3


class PredictRequest(BaseModel):
    inputs: Dict[str, Any]


@router.get("/ml/{dataset_id}/detect-problem/{target_column}", summary="Detect Problem Type")
def detect_problem(dataset_id: str, target_column: str):
    """Auto-detect whether the problem is regression, classification, or clustering."""
    try:
        return MLService.detect_problem_type(dataset_id, target_column)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")


@router.get("/ml/{dataset_id}/analyze-target/{target_column}", summary="Analyze Target Column")
def analyze_target(dataset_id: str, target_column: str):
    """Analyze properties of target column including imbalance and missing values."""
    try:
        res = MLService.analyze_target_column(dataset_id, target_column)
        # Log to ledger
        DataService.log_action(dataset_id, "ml_target_select", {
            "target_column": target_column,
            "problem_type": res["problem_type"],
            "datatype": res["datatype"],
            "unique_count": res["unique_count"],
            "is_imbalanced": res["is_imbalanced"]
        })
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")


@router.post("/ml/{dataset_id}/train", summary="Train Model")
def train_model(dataset_id: str, req: TrainRequest):
    """Train an ML model and return evaluation metrics (Default)."""
    try:
        res = MLService.train_model(
            dataset_id=dataset_id,
            target_column=req.target_column,
            algorithm=req.algorithm,
            feature_columns=req.feature_columns,
            test_size=req.test_size,
            n_clusters=req.n_clusters,
        )
        DataService.log_action(dataset_id, "ml_train", req.model_dump())
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        logger.error(f"ML training error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/ml/{dataset_id}/train-v2", summary="Train Model V2")
def train_model_v2(dataset_id: str, req: TrainV2Request):
    """Train an ML model with advanced preprocessing settings."""
    try:
        res = MLService.train_model_v2(
            dataset_id=dataset_id,
            target_column=req.target_column,
            algorithm=req.algorithm,
            feature_columns=req.feature_columns,
            test_size=req.test_size,
            scaling_method=req.scaling_method,
            imputation_strategy=req.imputation_strategy,
            stratify_split=req.stratify_split,
            categorical_encoding=req.categorical_encoding,
            hyperparameters=req.hyperparameters,
            n_clusters=req.n_clusters,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        logger.error(f"ML training v2 error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/ml/{dataset_id}/tune", summary="Tune Model Hyperparameters")
def tune_model(dataset_id: str, req: TrainV2Request):
    """Perform grid search tuning for standard model parameters."""
    try:
        res = MLService.tune_hyperparameters(
            dataset_id=dataset_id,
            target_column=req.target_column,
            algorithm=req.algorithm,
            feature_columns=req.feature_columns,
            test_size=req.test_size,
            scaling_method=req.scaling_method,
            imputation_strategy=req.imputation_strategy,
            stratify_split=req.stratify_split,
            categorical_encoding=req.categorical_encoding,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        logger.error(f"ML tuning error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Tuning failed: {str(e)}")


@router.post("/ml/{dataset_id}/compare", summary="Compare Models")
def compare_models(dataset_id: str, req: CompareRequest):
    """Train and compare multiple ML models."""
    try:
        return MLService.compare_models(
            dataset_id=dataset_id,
            target_column=req.target_column,
            algorithms=req.algorithms,
            test_size=req.test_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ml/{dataset_id}/predict/{experiment_id}", summary="Predict Custom Custom Data")
def predict_custom(dataset_id: str, experiment_id: str, req: PredictRequest):
    """Run prediction on a dictionary input using the trained model pipeline."""
    try:
        res = MLService.predict_custom(experiment_id, req.inputs)
        # Log prediction to ledger
        DataService.log_action(dataset_id, "ml_predict", {
            "experiment_id": experiment_id,
            "inputs": req.inputs,
            "prediction": res["prediction"]
        })
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"ML prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/ml/{dataset_id}/save-pipeline/{experiment_id}", summary="Save Model Pipeline to Disk")
def save_pipeline(dataset_id: str, experiment_id: str):
    """Persist the trained model pipeline to disk."""
    try:
        path = MLService.save_model_pipeline(dataset_id, experiment_id)
        return {"experiment_id": experiment_id, "model_path": path, "status": "Saved successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
