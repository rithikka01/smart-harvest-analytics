import joblib
import numpy as np
import pandas as pd
from pathlib import Path


class CropPredictionService:
    """Serves the two Random Forest models trained from smart_harvest_dataset.xlsx.

    - crop_yield_model.pkl: RandomForestRegressor -> water_usage_efficiency (17 features)
    - crop_recommendation_model.pkl: RandomForestClassifier -> crop_type (4 features)
    """

    def __init__(self):
        self.model_path = Path(__file__).parent
        self.model = None
        self.metadata = None
        self.label_encoders = None
        self.reco_model = None
        self.reco_metadata = None
        self.load_model()

    def load_model(self):
        try:
            self.model = joblib.load(self.model_path / "crop_yield_model.pkl")
            self.metadata = joblib.load(self.model_path / "model_metadata.pkl")
            self.label_encoders = joblib.load(self.model_path / "label_encoders.pkl")
            print("ML: water-efficiency regressor loaded")
        except Exception as e:
            print(f"ML: water-efficiency regressor not found: {e}")
            self.model = None
        try:
            self.reco_model = joblib.load(self.model_path / "crop_recommendation_model.pkl")
            self.reco_metadata = joblib.load(self.model_path / "crop_recommendation_metadata.pkl")
            print("ML: crop recommendation classifier loaded")
        except Exception as e:
            print(f"ML: crop recommendation classifier not found: {e}")
            self.reco_model = None

    # ---------- model info ----------
    def model_info(self):
        info = {"regressor": None, "classifier": None}
        if self.model is not None:
            info["regressor"] = {
                "file": "crop_yield_model.pkl",
                "algorithm": type(self.model).__name__,
                "n_estimators": getattr(self.model, "n_estimators", None),
                "n_features": int(getattr(self.model, "n_features_in_", 0)),
                "target": self.metadata.get("target_column") if self.metadata else None,
                "features": self.metadata.get("feature_names") if self.metadata else None,
                "note": "Used only as a water-efficiency factor; crop health/yield outputs are rule-based estimates.",
            }
        if self.reco_model is not None:
            info["classifier"] = {
                "file": "crop_recommendation_model.pkl",
                "algorithm": self.reco_metadata.get("algorithm"),
                "n_estimators": self.reco_metadata.get("n_estimators"),
                "target": self.reco_metadata.get("target_column"),
                "features": self.reco_metadata.get("feature_names"),
                "classes": len(self.reco_metadata.get("classes", [])),
                "dataset_rows": self.reco_metadata.get("dataset_rows"),
                "metrics": self.reco_metadata.get("metrics"),
                "feature_ranges": self.reco_metadata.get("feature_ranges"),
            }
        return info

    # ---------- crop recommendation (real ML classifier) ----------
    def recommend_crop(self, temperature, humidity, ph, rainfall, top_n=5):
        if self.reco_model is None:
            raise RuntimeError("Crop recommendation model not loaded")
        X = pd.DataFrame([[temperature, humidity, ph, rainfall]], columns=self.reco_metadata["feature_names"])
        probs = self.reco_model.predict_proba(X)[0]
        order = np.argsort(probs)[::-1][:top_n]
        classes = self.reco_model.classes_
        ranges = self.reco_metadata.get("feature_ranges", {})
        warnings = []
        for name, val in zip(self.reco_metadata["feature_names"], [temperature, humidity, ph, rainfall]):
            lo, hi = ranges.get(name, [None, None])
            if lo is not None and (val < lo or val > hi):
                warnings.append(f"{name} = {val} is outside the training range ({lo} to {hi}); prediction may be less reliable.")
        return {
            "method": "ml",
            "model": "RandomForestClassifier (crop_recommendation_model.pkl)",
            "recommended_crop": str(classes[order[0]]),
            "top_recommendations": [
                {"crop": str(classes[i]), "confidence": round(float(probs[i]), 4)} for i in order
            ],
            "inputs": {"temperature": temperature, "humidity": humidity, "ph": ph, "rainfall": rainfall},
            "metrics": self.reco_metadata.get("metrics"),
            "warnings": warnings,
        }

    # ---------- crop health (rule-based, ML factor) ----------
    def predict_crop_health(self, sensor_data, crop_type="Rice"):
        try:
            efficiency = self._water_efficiency(sensor_data, crop_type)
            health_status, reasons, score = self._analyze_health(sensor_data, efficiency)
            recommendations = self._generate_recommendations(sensor_data, health_status)
            return {
                "health_status": health_status,
                "confidence": score,
                "method": "rule-based" + (" + ML water-efficiency factor" if efficiency is not None else ""),
                "water_efficiency_score": round(float(efficiency), 2) if efficiency is not None else None,
                "reasons": reasons,
                "recommendations": recommendations,
            }
        except Exception as e:
            print(f"Prediction error: {e}")
            return self._rule_based_health(sensor_data)

    # ---------- yield estimate (heuristic) ----------
    def predict_yield(self, sensor_data, crop_type, field_size):
        efficiency = self._water_efficiency(sensor_data, crop_type)
        base_yield_per_acre = 2.5  # generic reference, tons/acre
        factor = 1.0
        if efficiency is not None:
            factor = max(0.6, min(1.3, efficiency / 3.0))
        moisture = sensor_data.get("soil_moisture", 45)
        if moisture < 30 or moisture > 75:
            factor *= 0.85
        estimated_yield = field_size * base_yield_per_acre * factor
        return {
            "estimated_yield": round(estimated_yield, 2),
            "unit": "tons",
            "method": "heuristic estimate" + (" (ML water-efficiency factor applied)" if efficiency is not None else ""),
            "confidence": None,
            "water_efficiency": round(float(efficiency), 2) if efficiency is not None else None,
            "comparison": {
                "regional_average": round(field_size * base_yield_per_acre, 2),
                "last_season": None,
            },
            "disclaimer": "Yield is a rough estimate based on a generic 2.5 t/acre reference adjusted by current conditions. It is not a validated ML yield prediction.",
        }

    # ---------- helpers ----------
    def _water_efficiency(self, sensor_data, crop_type):
        if self.model is None or not self.metadata:
            return None
        try:
            features = self._prepare_features(sensor_data, crop_type)
            X = pd.DataFrame([features], columns=self.metadata["feature_names"])
            return float(self.model.predict(X)[0])
        except Exception as e:
            print(f"Water efficiency prediction error: {e}")
            return None

    def _prepare_features(self, sensor_data, crop_type):
        defaults = {
            "temperature": sensor_data.get("ambient_temperature", 25),
            "humidity": sensor_data.get("humidity", 65),
            "ph": 6.5,
            "rainfall": sensor_data.get("rainfall", 100),
            "crop_type": self._encode_crop_type(crop_type),
            "soil_moisture": min(30, max(10, sensor_data.get("soil_moisture", 45) * 0.3)),
            "soil_type": 2,
            "sunlight_exposure": min(12, max(5, sensor_data.get("light_intensity", 75000) / 10000)),
            "wind_speed": sensor_data.get("wind_kph", 10),
            "organic_matter": 5,
            "irrigation_frequency": 3,
            "crop_density": 12,
            "pest_pressure": 50,
            "fertilizer_usage": 125,
            "growth_stage": 2,
            "water_source_type": 2,
            "frost_risk": 50,
        }
        return [defaults[name] for name in self.metadata["feature_names"]]

    def _encode_crop_type(self, crop_type):
        enc = (self.label_encoders or {}).get("crop_type")
        if enc is None:
            return 0
        key = str(crop_type).strip().lower()
        classes = list(enc.classes_)
        return classes.index(key) if key in classes else classes.index("rice") if "rice" in classes else 0

    def _analyze_health(self, sensor_data, water_efficiency):
        reasons = []
        penalties = 0
        soil_moisture = sensor_data.get("soil_moisture", 0)
        if soil_moisture < 30:
            status = "High Stress"; penalties += 2
            reasons.append(f"Soil moisture critically low at {soil_moisture}%")
        elif soil_moisture < 40:
            status = "Moderate Stress"; penalties += 1
            reasons.append(f"Soil moisture below optimal at {soil_moisture}%")
        elif soil_moisture > 70:
            status = "Moderate Stress"; penalties += 1
            reasons.append(f"Soil moisture too high at {soil_moisture}%, risk of waterlogging")
        else:
            status = "Healthy"
            reasons.append(f"Soil moisture optimal at {soil_moisture}%")

        temp = sensor_data.get("ambient_temperature", 0)
        if temp > 38:
            status = "High Stress"; penalties += 2
            reasons.append(f"Severe heat stress at {temp}°C")
        elif temp > 35:
            if status == "Healthy":
                status = "Moderate Stress"
            penalties += 1
            reasons.append(f"High temperature stress at {temp}°C")
        elif temp < 15:
            if status == "Healthy":
                status = "Moderate Stress"
            penalties += 1
            reasons.append(f"Low temperature may slow growth at {temp}°C")

        humidity = sensor_data.get("humidity", 0)
        if humidity < 40:
            penalties += 1
            reasons.append("Low humidity may cause water stress")
        elif humidity > 85:
            penalties += 1
            reasons.append("Very high humidity increases fungal disease risk")

        light = sensor_data.get("light_intensity")
        if light is not None and light < 10000:
            penalties += 1
            reasons.append(f"Low light intensity ({int(light)} lux) may limit photosynthesis")

        if water_efficiency is not None:
            if water_efficiency < 2.0:
                reasons.append("Model water-efficiency factor is low; optimise irrigation")
            elif water_efficiency > 3.5:
                reasons.append("Model water-efficiency factor is high")

        score = round(max(0.3, 1.0 - 0.15 * penalties), 2)
        return status, reasons, score

    def _generate_recommendations(self, sensor_data, health_status):
        recommendations = []
        soil_moisture = sensor_data.get("soil_moisture", 0)
        temp = sensor_data.get("ambient_temperature", 0)
        if soil_moisture < 40:
            recommendations.append("Increase irrigation frequency")
            recommendations.append("Consider drip irrigation for water efficiency")
        elif soil_moisture > 70:
            recommendations.append("Reduce irrigation to prevent waterlogging")
            recommendations.append("Ensure proper drainage in the field")
        if temp > 35:
            recommendations.append("Use mulching to reduce heat stress")
            recommendations.append("Irrigate during early morning or evening")
        if sensor_data.get("humidity", 0) > 85:
            recommendations.append("Scout for fungal disease; improve air circulation")
        if health_status == "Healthy":
            recommendations.append("Continue current management practices")
            recommendations.append("Monitor readings regularly")
        return recommendations

    def _rule_based_health(self, sensor_data):
        soil_moisture = sensor_data.get("soil_moisture", 50)
        temp = sensor_data.get("ambient_temperature", 25)
        if soil_moisture < 30 or temp > 38:
            status = "High Stress"
        elif soil_moisture < 40 or temp > 35:
            status = "Moderate Stress"
        else:
            status = "Healthy"
        return {
            "health_status": status,
            "confidence": 0.7,
            "method": "rule-based",
            "reasons": [f"Soil moisture: {soil_moisture}%", f"Temperature: {temp}°C"],
            "recommendations": ["Monitor soil moisture regularly", "Ensure adequate irrigation"],
        }


ml_service = CropPredictionService()
