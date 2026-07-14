"""Layout data extracted from the original workspace reference (POI + zone positions)."""
from __future__ import annotations

import math

# Exact POI transforms from the reference office layout.
REFERENCE_POIS: list[tuple[str, tuple[float, float, float], float]] = [
    ('poi-idle-area-boardroom', (1.269, -3.540, 0.0), math.pi),
    ('poi-idle-area-canteen', (-3.227, 1.088, 0.0), math.pi),
    ('poi-idle-area-hub', (-2.045, -2.361, 0.0), math.pi),
    ('poi-idle-area-workspace', (3.145, -0.522, 0.0), math.pi),
    ('poi-idle-spawn-1', (-3.142, -4.466, 0.0), math.pi),
    ('poi-idle-spawn-2', (-3.568, 1.294, 0.0), 0.929),
    ('poi-idle-spawn-3', (4.062, -3.350, 0.0), -0.486),
    ('poi-idle-spawn-4', (3.769, 0.072, 0.0), 0.503),
    ('poi-idle-spawn-5', (2.575, -3.946, 0.0), 1.795),
    ('poi-sit_idle-1', (-3.175, 4.463, 0.003), 0.0),
    ('poi-sit_idle-2', (-3.743, 2.860, 0.003), math.pi / 2),
    ('poi-sit_idle-3', (-4.461, -1.304, 0.003), 0.0),
    ('poi-sit_idle-4', (-3.620, -1.308, 0.003), 0.0),
    ('poi-sit_work-1', (-4.135, -4.490, 0.0), math.pi),
    ('poi-sit_work-2', (1.579, 3.671, 0.003), 0.0),
    ('poi-sit_work-3', (3.351, 3.671, 0.003), 0.0),
    ('poi-sit_work-4', (3.092, 1.271, 0.003), -math.pi / 2),
    ('poi-sit_work-5', (1.100, 1.235, 0.003), math.pi / 2),
]

# Reference skeleton rest pose (Blender space) for matching animation feel.
REFERENCE_BONES: list[tuple[str, str | None, tuple[float, float, float], tuple[float, float, float]]] = [
    ('root', None, (0.0, 0.0, 0.0), (0.0, 0.2627, 0.0)),
    ('hips', 'root', (0.0, 0.0, 0.2627), (0.0, 0.1121, 0.2624)),
    ('leg.L', 'hips', (0.1076, 0.0, 0.2152), (0.1076, 0.0, 0.1031)),
    ('leg.R', 'hips', (-0.1015, 0.0, 0.2152), (-0.1015, 0.0, 0.1031)),
    ('spine', 'hips', (0.0025, 0.0, 0.3284), (0.0025, 0.0, 0.5843)),
    ('head', 'spine', (0.0025, 0.0, 0.6080), (0.0025, 0.0, 0.8639)),
    ('arm.L', 'spine', (0.1015, 0.0407, 0.5687), (0.2122, 0.0454, 0.4607)),
    ('lower.arm.L', 'arm.L', (0.2122, 0.0454, 0.4607), (0.3092, 0.0007, 0.3488)),
    ('arm.R', 'spine', (-0.0919, 0.0413, 0.5626), (-0.1969, 0.0494, 0.4619)),
    ('lower.arm.R', 'arm.R', (-0.1969, 0.0494, 0.4619), (-0.3026, 0.0099, 0.3697)),
]
