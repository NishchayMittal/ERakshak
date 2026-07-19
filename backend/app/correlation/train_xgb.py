import csv
import os
import sys

# Ensure backend folder is in path
sys.path.append(os.path.abspath("backend"))

import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
CSV_PATH = os.path.join(app_dir, "resources", "synthetic_pairs.csv")
MODEL_PATH = os.path.join(app_dir, "resources", "xgboost_model.json")

FEATURE_COLS = [
    "name_similarity",
    "username_similarity",
    "exact_match",
    "email_username_match",
    "shared_findings_count",
    "shared_domains"
]

def load_data(csv_path):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Synthetic pairs CSV not found at {csv_path}. Please run generate_synthetic.py first.")
        
    X = []
    y = []
    
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            feat_vector = [
                float(row["name_similarity"]),
                float(row["username_similarity"]),
                float(row["exact_match"]),
                float(row["email_username_match"]),
                float(row["shared_findings_count"]),
                float(row["shared_domains"])
            ]
            X.append(feat_vector)
            y.append(int(row["label"]))
            
    return X, y

def train_model():
    print(f"Loading synthetic dataset from {CSV_PATH}...")
    X, y = load_data(CSV_PATH)
    
    print(f"Loaded {len(X)} sample pairs.")
    
    # Split into train/test (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("\nTraining XGBoost Classifier...")
    # Initialize XGBClassifier
    model = xgb.XGBClassifier(
        n_estimators=50,
        max_depth=3,
        learning_rate=0.1,
        random_state=42,
        eval_metric="logloss"
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate model
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Feature Importances
    print("\nFeature Importances:")
    importances = model.feature_importances_
    for col, imp in zip(FEATURE_COLS, importances):
        print(f"  {col}: {imp:.4f}")
        
    # Save model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)
    print(f"\nSaved trained XGBoost model to {MODEL_PATH}")

if __name__ == "__main__":
    train_model()
