"""
Flood Prediction Service - Integration with XGBoost Tambon Model
Connects to external flood prediction API
"""
import httpx
from typing import Dict, List, Optional
from datetime import datetime
import asyncio


class FloodPredictionService:
    """
    Service for fetching tambon-level flood predictions
    from the XGBoost model API
    """
    
    def __init__(self):
        self.api_url = "https://flood-prediction-api-715107904640.asia-southeast1.run.app"
        self.timeout = 30.0
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = 3600  # 1 hour
        print(f"🌊 Flood Prediction Service initialized (API: {self.api_url})")
    
    async def get_tambon_prediction(self, tb_idn: str) -> Optional[Dict]:
        """
        Get flood prediction for a single tambon
        
        Args:
            tb_idn: Tambon ID (e.g., "800203")
        
        Returns:
            Dictionary with prediction data or None
        """
        # Check cache
        cache_key = f"tambon_{tb_idn}"
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if (datetime.now() - cached_time).seconds < self.cache_ttl:
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_url}/predict/{tb_idn}")
                
                if response.status_code == 200:
                    data = response.json()
                    # Cache the result
                    self.cache[cache_key] = (data, datetime.now())
                    return data
                else:
                    print(f"⚠️  Tambon {tb_idn} not found: {response.status_code}")
                    return None
                    
        except Exception as e:
            print(f"❌ Error fetching tambon prediction: {e}")
            return None
    
    async def get_province_predictions(self, province_name: str) -> List[Dict]:
        """
        Get all tambon predictions in a province
        
        Args:
            province_name: Province name in Thai (e.g., "จ.นครศรีธรรมราช")
        
        Returns:
            List of prediction dictionaries
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.api_url}/predict/province/{province_name}"
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"⚠️  Province {province_name} not found")
                    return []
                    
        except Exception as e:
            print(f"❌ Error fetching province predictions: {e}")
            return []
    
    async def get_top_risk_tambons(self, limit: int = 100) -> List[Dict]:
        """
        Get top N highest risk tambons
        
        Args:
            limit: Number of tambons to return
        
        Returns:
            List of high-risk tambons
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_url}/top/{limit}")
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, dict) and "results" in data:
                        return data["results"]
                    if isinstance(data, list):
                        return data
                    return []
                else:
                    return []
                    
        except Exception as e:
            print(f"❌ Error fetching top risk tambons: {e}")
            return []
    
    async def get_risk_stats(self) -> Dict:
        """
        Get overall risk distribution statistics
        
        Returns:
            Dictionary with risk level counts
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_url}/stats")
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {}
                    
        except Exception as e:
            print(f"❌ Error fetching risk stats: {e}")
            return {}
    
    async def search_tambons(self, query: str) -> List[Dict]:
        """
        Search tambons by name
        
        Args:
            query: Search keyword
        
        Returns:
            List of matching tambons
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.api_url}/search",
                    params={"q": query}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return []
                    
        except Exception as e:
            print(f"❌ Error searching tambons: {e}")
            return []
    
    async def get_basin_tambons_summary(self, basin_id: str) -> Dict:
        """
        Get aggregated flood risk for all tambons in a basin
        
        Args:
            basin_id: Basin identifier
        
        Returns:
            Summary statistics for the basin
        """
        # Map basin to provinces (simplified mapping)
        basin_provinces = {
            "chao-phraya": ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "พระนครศรีอยุธยา", "อ่างทอง"],
            "mekong": ["เชียงราย", "เลย", "หนองคาย", "นครพนม", "มุกดาหาร"],
            "chi": ["ขอนแก่น", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์"],
            "mun": ["นครราชสีมา", "บุรีรัมย์", "สุรินทร์", "ศรีสะเกษ", "อุบลราชธานี"],
            "ping": ["เชียงใหม่", "ลำพูน", "ลำปาง"],
            "nan": ["น่าน", "พะเยา", "อุตรดิตถ์"],
            "yom": ["พิษณุโลก", "สุโขทัย", "พิจิตร"],
            "southern": ["นครศรีธรรมราช", "สุราษฎร์ธานี", "ชุมพร", "ระนอง"]
        }
        
        provinces = basin_provinces.get(basin_id, [])
        
        if not provinces:
            return {
                "basin_id": basin_id,
                "total_tambons": 0,
                "high_risk_count": 0,
                "avg_probability": 0,
                "top_risk_tambons": []
            }
        
        # Fetch predictions for all provinces in basin
        all_tambons = []
        for province in provinces:
            tambons = await self.get_province_predictions(f"จ.{province}")
            all_tambons.extend(tambons)
        
        if not all_tambons:
            return {
                "basin_id": basin_id,
                "total_tambons": 0,
                "high_risk_count": 0,
                "avg_probability": 0,
                "top_risk_tambons": []
            }
        
        # Calculate statistics
        high_risk = [t for t in all_tambons if t.get("risk_level") in ["VERY_HIGH", "HIGH"]]
        avg_prob = sum(t.get("flood_probability", 0) for t in all_tambons) / len(all_tambons)
        top_risk = sorted(all_tambons, key=lambda x: x.get("flood_probability", 0), reverse=True)[:10]
        
        return {
            "basin_id": basin_id,
            "total_tambons": len(all_tambons),
            "high_risk_count": len(high_risk),
            "avg_probability": round(avg_prob, 4),
            "avg_percent": round(avg_prob * 100, 1),
            "top_risk_tambons": top_risk,
            "risk_distribution": {
                "VERY_HIGH": len([t for t in all_tambons if t.get("risk_level") == "VERY_HIGH"]),
                "HIGH": len([t for t in all_tambons if t.get("risk_level") == "HIGH"]),
                "MEDIUM": len([t for t in all_tambons if t.get("risk_level") == "MEDIUM"]),
                "LOW": len([t for t in all_tambons if t.get("risk_level") == "LOW"]),
                "VERY_LOW": len([t for t in all_tambons if t.get("risk_level") == "VERY_LOW"]),
            }
        }


# Singleton instance
_flood_service = None

def get_flood_prediction_service() -> FloodPredictionService:
    """Get singleton flood prediction service instance"""
    global _flood_service
    if _flood_service is None:
        _flood_service = FloodPredictionService()
    return _flood_service
