"""
Grid-based tile system for Thailand flood risk heatmap
Divides Thailand into ~50km x 50km tiles (0.5° x 0.5°)
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Thailand bounds: ~5.5°N to 20.5°N, ~97.5°E to 105.5°E
THAILAND_BOUNDS = {
    "lat_min": 5.5,
    "lat_max": 20.5,
    "lon_min": 97.5,
    "lon_max": 105.5,
}

TILE_SIZE = 0.5  # degrees (~50km)

# Thailand polygon (simplified) - approximate border
# Format: list of (lat, lon) points
THAILAND_POLYGON = [
    (20.5, 100.0),  # North
    (20.0, 100.5),
    (19.5, 101.0),
    (18.5, 102.0),
    (17.5, 104.0),
    (16.5, 105.0),
    (15.5, 105.5),  # Northeast
    (14.5, 105.0),
    (14.0, 104.5),
    (13.5, 103.5),
    (13.0, 102.5),
    (12.5, 102.0),  # East
    (11.5, 102.5),
    (11.0, 103.0),
    (10.0, 103.5),
    (9.0, 103.0),
    (8.0, 102.0),
    (7.0, 101.5),
    (6.5, 101.0),  # South
    (6.0, 100.5),
    (5.5, 100.0),
    (6.0, 99.5),
    (7.0, 99.0),
    (8.0, 98.5),
    (9.0, 98.5),
    (10.0, 98.5),  # West coast
    (11.0, 99.0),
    (12.0, 99.5),
    (13.0, 99.5),
    (14.0, 99.5),
    (15.0, 99.0),
    (16.0, 98.5),
    (17.0, 98.0),
    (18.0, 98.0),
    (19.0, 98.5),
    (19.5, 99.0),
    (20.0, 99.5),
    (20.5, 100.0),  # Back to start
]


def point_in_polygon(lat: float, lon: float, polygon: List[tuple]) -> bool:
    """Check if point is inside polygon using ray casting algorithm"""
    n = len(polygon)
    inside = False
    
    p1_lat, p1_lon = polygon[0]
    for i in range(1, n + 1):
        p2_lat, p2_lon = polygon[i % n]
        if lon > min(p1_lon, p2_lon):
            if lon <= max(p1_lon, p2_lon):
                if lat <= max(p1_lat, p2_lat):
                    if p1_lon != p2_lon:
                        xinters = (lon - p1_lon) * (p2_lat - p1_lat) / (p2_lon - p1_lon) + p1_lat
                    if p1_lat == p2_lat or lat <= xinters:
                        inside = not inside
        p1_lat, p1_lon = p2_lat, p2_lon
    
    return inside


def is_tile_in_thailand(lat: float, lon: float) -> bool:
    """Check if tile center is within Thailand"""
    center_lat = lat + TILE_SIZE / 2
    center_lon = lon + TILE_SIZE / 2
    return point_in_polygon(center_lat, center_lon, THAILAND_POLYGON)

# Province mapping for tiles (simplified)
TILE_PROVINCES = {
    "19.5_99.5": ["เชียงใหม่", "ลำพูน"],
    "19.0_99.5": ["เชียงใหม่", "ลำปาง"],
    "18.5_100.0": ["ลำปาง", "แพร่"],
    "18.0_100.5": ["แพร่", "น่าน"],
    "17.5_100.5": ["พิษณุโลก", "สุโขทัย"],
    "16.5_100.0": ["พิจิตร", "นครสวรรค์"],
    "16.0_102.5": ["ขอนแก่น", "มหาสารคาม"],
    "15.5_102.0": ["ขอนแก่น", "กาฬสินธุ์"],
    "15.0_104.0": ["อุบลราชธานี", "ยโสธร"],
    "14.5_100.5": ["อยุธยา", "ลพบุรี"],
    "14.0_100.5": ["ปทุมธานี", "นนทบุรี"],
    "13.5_100.5": ["กรุงเทพฯ", "สมุทรปราการ"],
    "13.0_100.0": ["สมุทรสาคร", "สมุทรสงคราม"],
    "12.5_101.5": ["ชลบุรี", "ระยอง"],
    "11.0_99.5": ["ประจวบคีรีขันธ์", "เพชรบุรี"],
    "9.5_99.0": ["สุราษฎร์ธานี", "ชุมพร"],
    "8.0_99.5": ["นครศรีธรรมราช", "พัทลุง"],
    "7.0_100.5": ["สงขลา", "ปัตตานี"],
}


def generate_tile_id(lat: float, lon: float) -> str:
    """Generate unique tile ID from coordinates"""
    return f"{lat:.1f}_{lon:.1f}"


def get_tile_bounds(lat: float, lon: float) -> List[List[float]]:
    """Get SW and NE corners of tile"""
    return [
        [lat, lon],  # SW corner
        [lat + TILE_SIZE, lon + TILE_SIZE],  # NE corner
    ]


def iter_thailand_tile_origins() -> List[tuple]:
    """
    Iterate over tile origin coordinates (SW corner) that are inside Thailand.

    Returns list of (lat, lon).
    """
    coords: List[tuple] = []
    lat = THAILAND_BOUNDS["lat_min"]
    while lat < THAILAND_BOUNDS["lat_max"]:
        lon = THAILAND_BOUNDS["lon_min"]
        while lon < THAILAND_BOUNDS["lon_max"]:
            if is_tile_in_thailand(lat, lon):
                coords.append((round(lat, 1), round(lon, 1)))
            lon += TILE_SIZE
        lat += TILE_SIZE
    return coords


def tile_polygon_coordinates(lat: float, lon: float) -> List[List[List[float]]]:
    """
    GeoJSON Polygon coordinates for the tile.
    Input: tile origin (SW corner) in degrees.
    Output: GeoJSON coordinates in [lon, lat] order.
    """
    bounds = get_tile_bounds(lat, lon)
    (sw_lat, sw_lon), (ne_lat, ne_lon) = bounds
    return [[
        [sw_lon, sw_lat],
        [ne_lon, sw_lat],
        [ne_lon, ne_lat],
        [sw_lon, ne_lat],
        [sw_lon, sw_lat],
    ]]


def generate_tile_geometries() -> List[Dict[str, Any]]:
    """
    Generate tile geometry skeletons (no simulated stats).
    """
    tiles: List[Dict[str, Any]] = []
    for lat, lon in iter_thailand_tile_origins():
        tiles.append({
            "id": generate_tile_id(lat, lon),
            "bounds": get_tile_bounds(lat, lon),
            "center": [lat + TILE_SIZE / 2, lon + TILE_SIZE / 2],
            "geometry": {
                "type": "Polygon",
                "coordinates": tile_polygon_coordinates(lat, lon),
            },
        })
    return tiles


def calculate_risk_level(water_level: float, rainfall: float) -> str:
    """Calculate risk level based on water level and rainfall"""
    if water_level > 4.5 or rainfall > 150:
        return "critical"
    elif water_level > 4.0 or rainfall > 100:
        return "warning"
    elif water_level > 3.5 or rainfall > 60:
        return "watch"
    elif water_level > 3.0 or rainfall > 30:
        return "normal"
    else:
        return "safe"


def generate_thailand_tiles() -> List[Dict[str, Any]]:
    """Generate all tiles covering Thailand"""
    tiles = []
    
    lat = THAILAND_BOUNDS["lat_min"]
    while lat < THAILAND_BOUNDS["lat_max"]:
        lon = THAILAND_BOUNDS["lon_min"]
        while lon < THAILAND_BOUNDS["lon_max"]:
            # Check if tile is within Thailand
            if not is_tile_in_thailand(lat, lon):
                lon += TILE_SIZE
                continue
            
            tile_id = generate_tile_id(lat, lon)
            
            # Keep legacy API for backward compatibility but do not fabricate metrics here.
            # The real, DB-backed implementation lives in backend/app/api/endpoints/tiles.py
            tile = {
                "id": tile_id,
                "bounds": get_tile_bounds(lat, lon),
                "center": [lat + TILE_SIZE/2, lon + TILE_SIZE/2],
                "riskLevel": "safe",
                "stats": {
                    "avgWaterLevel": 0.0,
                    "rainfall24h": 0.0,
                    "stationCount": 0,
                    "populationAtRisk": 0,
                    "trend": "stable",
                    "trendPercent": 0.0,
                },
                "provinces": TILE_PROVINCES.get(tile_id, ["ไม่ระบุ"]),
                "rivers": [],
                "dams": [],
                "aiPrediction": {"floodProbability": 0.0, "daysAhead": 1},
                "lastUpdate": datetime.now().isoformat(),
            }
            
            tiles.append(tile)
            lon += TILE_SIZE
        lat += TILE_SIZE
    
    return tiles


def get_tiles_by_risk(risk_level: str = None) -> List[Dict[str, Any]]:
    """Get tiles filtered by risk level"""
    tiles = generate_thailand_tiles()
    
    if risk_level:
        tiles = [t for t in tiles if t["riskLevel"] == risk_level]
    
    return tiles


def get_tile_by_id(tile_id: str) -> Dict[str, Any]:
    """Get specific tile by ID"""
    tiles = generate_thailand_tiles()
    
    for tile in tiles:
        if tile["id"] == tile_id:
            return tile
    
    return None


def get_tile_history(tile_id: str, days: int = 7) -> List[Dict[str, Any]]:
    """Get historical data for a tile"""
    history = []
    
    for i in range(days):
        date = datetime.now() - timedelta(days=i)
        
        # Simulate historical data
        avg_water_level = random.uniform(2.5, 5.0)
        rainfall_24h = random.uniform(0, 180)
        
        history.append({
            "date": date.isoformat(),
            "avgWaterLevel": round(avg_water_level, 2),
            "rainfall24h": round(rainfall_24h, 1),
            "riskLevel": calculate_risk_level(avg_water_level, rainfall_24h),
        })
    
    return list(reversed(history))


def get_tiles_summary() -> Dict[str, Any]:
    """Get summary statistics of all tiles"""
    tiles = generate_thailand_tiles()
    
    risk_counts = {
        "safe": 0,
        "normal": 0,
        "watch": 0,
        "warning": 0,
        "critical": 0,
    }
    
    total_population_at_risk = 0
    
    for tile in tiles:
        risk_counts[tile["riskLevel"]] += 1
        total_population_at_risk += tile["stats"]["populationAtRisk"]
    
    return {
        "totalTiles": len(tiles),
        "riskCounts": risk_counts,
        "totalPopulationAtRisk": total_population_at_risk,
        "lastUpdate": datetime.now().isoformat(),
    }
