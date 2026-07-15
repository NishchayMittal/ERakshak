from fastapi import APIRouter, Depends, BackgroundTasks
from app.auth import get_current_investigator
from app.models import Investigator

router = APIRouter(prefix="/model", tags=["model"])

@router.post("/retrain")
def trigger_manual_retrain(
    background_tasks: BackgroundTasks,
    current_investigator: Investigator = Depends(get_current_investigator)
):
    """
    Manually triggers the XGBoost model retraining in the background.
    """
    try:
        from app.correlation.train_xgb import train_model
    except ModuleNotFoundError as exc:
        if exc.name == "xgboost":
            return {"message": "Model retraining is unavailable because xgboost is not installed."}
        raise

    background_tasks.add_task(train_model)
    return {"message": "Model retraining triggered in the background."}
