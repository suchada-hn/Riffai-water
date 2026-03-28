"""
AI Service for flood prediction using HydroLSTM
"""
import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any
import os
import tempfile


class AIService:
    """
    AI Service for flood prediction
    
    Uses HydroLSTM model when available, falls back to rule-based prediction
    """
    
    def __init__(self):
        self.models = {}
        self.model_loaded = False
        self.gcs_bucket = os.getenv("GCS_BUCKET_AI_MODELS", "riffai-ai-models")
        # Backend startup should be fast/reliable; model loading can be slow (GCS/auth/tensorflow).
        # Set RIFFAI_SKIP_AI_MODEL_LOAD=1 to defer model loading (rule-based fallback still works).
        skip = os.getenv("RIFFAI_SKIP_AI_MODEL_LOAD", "").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        if not skip:
            self._try_load_models()
    
    def _try_load_models(self):
        """Try to load trained models from Cloud Storage or local"""
        try:
            # Try to import HydroLSTM
            import sys
            ai_engine_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ai-engine')
            if os.path.exists(ai_engine_path):
                sys.path.append(ai_engine_path)
            
            from models.hydro_lstm import HydroLSTM
            
            basins = ['mekong_north', 'eastern_coast', 'southern_east']
            
            for basin_id in basins:
                try:
                    model = HydroLSTM(
                        input_timesteps=24,
                        output_timesteps=24,
                        n_features=4,
                        encoder_units=128,
                        decoder_units=128,
                        dropout=0.2
                    )
                    
                    # Try to load from local first
                    local_model_path = os.path.join(
                        ai_engine_path, 'models', 'trained', basin_id, 'model.h5'
                    )
                    local_scaler_path = os.path.join(
                        ai_engine_path, 'models', 'trained', basin_id, 'scalers.pkl'
                    )
                    
                    if os.path.exists(local_model_path) and os.path.exists(local_scaler_path):
                        print(f"📦 Loading {basin_id} model from local...")
                        model.load(local_model_path, local_scaler_path)
                        self.models[basin_id] = model
                        print(f"✅ {basin_id} model loaded from local")
                    else:
                        # Try to load from GCS
                        print(f"📦 Attempting to load {basin_id} model from GCS...")
                        if self._load_from_gcs(basin_id, model):
                            self.models[basin_id] = model
                            print(f"✅ {basin_id} model loaded from GCS")
                        else:
                            print(f"⚠️  {basin_id} model not found")
                
                except Exception as e:
                    print(f"⚠️  Could not load {basin_id} model: {e}")
            
            if self.models:
                self.model_loaded = True
                print(f"✅ Loaded {len(self.models)} AI models")
            else:
                print("⚠️  No AI models loaded, using rule-based fallback")
                
        except Exception as e:
            print(f"⚠️  Could not load AI models: {e}")
            print("    Using rule-based prediction fallback")
    
    def _load_from_gcs(self, basin_id: str, model) -> bool:
        """Load model from Google Cloud Storage"""
        try:
            from google.cloud import storage
            
            client = storage.Client()
            bucket = client.bucket(self.gcs_bucket)
            
            # Download model files to temp directory
            with tempfile.TemporaryDirectory() as tmpdir:
                model_path = os.path.join(tmpdir, 'model.h5')
                scaler_path = os.path.join(tmpdir, 'scalers.pkl')
                
                # Download model.h5
                blob = bucket.blob(f"{basin_id}/model.h5")
                blob.download_to_filename(model_path)
                
                # Download scalers.pkl
                blob = bucket.blob(f"{basin_id}/scalers.pkl")
                blob.download_to_filename(scaler_path)
                
                # Load model
                model.load(model_path, scaler_path)
                
            return True
            
        except Exception as e:
            print(f"    Could not load from GCS: {e}")
            return False
    
    def predict(
        self,
        basin_id: str,
        satellite_data: List[Tuple],
        water_data: List[Tuple],
        rainfall_data: List[Tuple],
        days_ahead: int = 30,
    ) -> Dict[str, Any]:
        """
        Predict flood probability and water levels
        
        Args:
            basin_id: Basin identifier
            satellite_data: List of (date, ndvi, ndwi, mndwi, water_area)
            water_data: List of (datetime, level_m)
            rainfall_data: List of (datetime, amount_mm)
            days_ahead: Number of days to predict ahead
        
        Returns:
            Dictionary with prediction results
        """
        
        if self.model_loaded and basin_id in self.models:
            return self._predict_with_lstm(
                basin_id, satellite_data, water_data, rainfall_data, days_ahead
            )
        else:
            return self._predict_rule_based(
                basin_id, satellite_data, water_data, rainfall_data, days_ahead
            )
    
    def _predict_with_lstm(
        self,
        basin_id: str,
        satellite_data: List[Tuple],
        water_data: List[Tuple],
        rainfall_data: List[Tuple],
        days_ahead: int,
    ) -> Dict[str, Any]:
        """
        Predict using HydroLSTM model
        
        TODO: Implement actual LSTM prediction
        """
        model = self.models[basin_id]
        
        # Prepare features
        # X = self._prepare_features(satellite_data, water_data, rainfall_data)
        
        # Predict
        # predictions = model.predict(X)
        
        # For now, fallback to rule-based
        return self._predict_rule_based(
            basin_id, satellite_data, water_data, rainfall_data, days_ahead
        )
    
    def _predict_rule_based(
        self,
        basin_id: str,
        satellite_data: List[Tuple],
        water_data: List[Tuple],
        rainfall_data: List[Tuple],
        days_ahead: int,
    ) -> Dict[str, Any]:
        """
        Rule-based prediction fallback
        
        Uses simple heuristics based on:
        - Recent water levels
        - Recent rainfall
        - Satellite water indices
        """
        
        # Calculate recent averages
        recent_water_level = 0.0
        if water_data:
            recent_levels = [level for _, level in water_data[-24:]]  # Last 24 hours
            recent_water_level = np.mean(recent_levels) if recent_levels else 0.0
        
        recent_rainfall = 0.0
        if rainfall_data:
            recent_rain = [amount for _, amount in rainfall_data[-24:]]  # Last 24 hours
            recent_rainfall = np.sum(recent_rain) if recent_rain else 0.0
        
        avg_ndwi = 0.0
        avg_water_area = 0.0
        if satellite_data:
            recent_sat = satellite_data[-5:]  # Last 5 images
            ndwi_values = [ndwi for _, _, ndwi, _, _ in recent_sat if ndwi is not None]
            water_areas = [area for _, _, _, _, area in recent_sat if area is not None]
            
            avg_ndwi = np.mean(ndwi_values) if ndwi_values else 0.0
            avg_water_area = np.mean(water_areas) if water_areas else 0.0
        
        # Rule-based flood probability
        flood_prob = 0.0
        
        # Factor 1: Water level (40% weight)
        if recent_water_level > 4.5:
            flood_prob += 0.4
        elif recent_water_level > 3.5:
            flood_prob += 0.3
        elif recent_water_level > 2.5:
            flood_prob += 0.15
        
        # Factor 2: Rainfall (30% weight)
        if recent_rainfall > 150:
            flood_prob += 0.3
        elif recent_rainfall > 100:
            flood_prob += 0.2
        elif recent_rainfall > 50:
            flood_prob += 0.1
        
        # Factor 3: NDWI (20% weight)
        if avg_ndwi > 0.4:
            flood_prob += 0.2
        elif avg_ndwi > 0.3:
            flood_prob += 0.15
        elif avg_ndwi > 0.2:
            flood_prob += 0.1
        
        # Factor 4: Time horizon (10% weight)
        # Longer predictions are less certain
        time_factor = max(0, 1 - (days_ahead / 90))
        flood_prob *= (0.9 + 0.1 * time_factor)
        
        # Cap probability
        flood_prob = min(flood_prob, 0.95)
        
        # Predict future water level
        # Simple linear extrapolation with rainfall factor
        rainfall_factor = 1 + (recent_rainfall / 200)
        predicted_water_level = recent_water_level * rainfall_factor
        predicted_water_level = min(predicted_water_level, 6.0)  # Cap at 6m
        
        # Estimate affected area
        # Assume 5% of basin area per meter above 3m
        affected_area_sqkm = 0.0
        if predicted_water_level > 3.0:
            # Get basin area from config
            basin_areas = {
                'mekong_north': 28000,
                'eastern_coast': 13830,
                'southern_east': 11850,
            }
            basin_area = basin_areas.get(basin_id, 15000)
            affected_area_sqkm = (predicted_water_level - 3.0) * 0.05 * basin_area
        
        # Confidence based on data availability
        data_quality = (
            min(len(water_data), 100) / 100 * 0.4 +
            min(len(rainfall_data), 100) / 100 * 0.3 +
            min(len(satellite_data), 10) / 10 * 0.3
        )
        confidence = data_quality * (1 - days_ahead / 180)  # Decrease with time
        confidence = max(0.3, min(confidence, 0.95))
        
        return {
            "flood_probability": round(flood_prob, 4),
            "predicted_water_level": round(predicted_water_level, 2),
            "affected_area_sqkm": round(affected_area_sqkm, 2),
            "confidence": round(confidence, 4),
            "model_version": "rule-based-v1",
            "model_accuracy": 0.75,  # Estimated accuracy for rule-based
            "factors": {
                "recent_water_level_m": round(recent_water_level, 2),
                "recent_rainfall_mm": round(recent_rainfall, 1),
                "avg_ndwi": round(avg_ndwi, 4),
                "avg_water_area_sqkm": round(avg_water_area, 2),
            }
        }
    
    def _prepare_features(
        self,
        satellite_data: List[Tuple],
        water_data: List[Tuple],
        rainfall_data: List[Tuple],
    ) -> np.ndarray:
        """
        Prepare features for LSTM model
        
        Features:
        - Precipitation (mm)
        - Water level (m)
        - Evapotranspiration (mm/month)
        - Previous discharge (m3/s)
        
        TODO: Implement proper feature engineering
        """
        # This would need to align all data to hourly intervals
        # and create proper feature matrix
        pass
