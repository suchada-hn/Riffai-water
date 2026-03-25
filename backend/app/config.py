from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "RIFFAI Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./riffai.db"  # Default to SQLite for Cloud Run
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # GCP
    GCP_PROJECT_ID: str = "riffai-platform"
    GCS_BUCKET_SATELLITE: str = "riffai-satellite-data"
    GCS_BUCKET_AI_MODELS: str = "riffai-ai-models"

    # ONWR / Z-Score data (private tiles proxied by backend)
    ONWR_DATA_BUCKET: str = "onwr-data"
    ZSCORE_VV_INPUT_PREFIX: str = "Model_Output"
    ZSCORE_VV_TILES_PREFIX: str = "tiles/zscore_vv"
    ZSCORE_VV_SUMMARY_PREFIX: str = "summary/zscore_vv"
    ZSCORE_VV_INDEX_PREFIX: str = "index/zscore_vv"
    ZSCORE_VV_TILE_FORMAT: str = "png"  # png only for now
    ZSCORE_VV_ZOOM_MIN: int = 6
    ZSCORE_VV_ZOOM_MAX: int = 12

    # Map platform basin IDs -> ONWR region folders
    ZSCORE_REGION_BY_BASIN_ID: dict = {
        "mekong_north": "UpperMekong",
        "eastern_coast": "EastCoast",
        "southern_east": "LowerSouthEast",
    }
    
    # Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Alert Thresholds
    ALERT_WATER_LEVEL_WARNING: float = 3.0
    ALERT_WATER_LEVEL_CRITICAL: float = 4.5
    ALERT_RAINFALL_WARNING: float = 100.0
    ALERT_NDWI_WARNING: float = 0.3
    
    # Basin configs
    BASINS: dict = {
        "mekong_north": {
            "name": "ลุ่มน้ำโขงเหนือ",
            "provinces": ["เชียงใหม่", "เชียงราย", "พะเยา"],
            "bbox": [98.0, 18.5, 101.5, 20.5]
        },
        "eastern_coast": {
            "name": "ลุ่มน้ำชายฝั่งทะเลตะวันออก",
            "provinces": ["ชลบุรี", "ระยอง", "จันทบุรี", "ตราด"],
            "bbox": [100.5, 11.5, 103.0, 13.5]
        },
        "southern_east": {
            "name": "ลุ่มน้ำภาคใต้ฝั่งตะวันออกตอนล่าง",
            "provinces": ["สงขลา", "ปัตตานี", "ยะลา", "นราธิวาส"],
            "bbox": [100.0, 5.5, 102.0, 7.5]
        }
    }
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
