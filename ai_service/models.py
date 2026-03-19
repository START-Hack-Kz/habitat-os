"""
Pydantic models mirroring shared/schemas/*.schema.ts contracts.
These are the source of truth for AI service I/O validation.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ── Enums / literals ──────────────────────────────────────────────────────────

RiskLevel = Literal["low", "moderate", "high", "critical"]
UrgencyLevel = Literal["immediate", "within_24h", "strategic"]
ActionType = Literal[
    "reallocate_water", "reduce_lighting", "adjust_temperature_setpoint",
    "reduce_zone_allocation", "prioritize_zone", "trigger_harvest_early",
    "pause_zone", "adjust_nutrient_mix",
]
MissionStatus = Literal["nominal", "warning", "critical", "nutrition_preservation_mode"]
ZoneStatus = Literal["healthy", "stressed", "critical", "harvesting", "replanting", "offline"]
StressType = Literal["none", "heat", "cold", "water_deficit", "nitrogen_deficiency",
                     "light_deficit", "energy_shortage", "salinity"]
StressSeverity = Literal["none", "low", "moderate", "high", "critical"]
NutritionTrend = Literal["improving", "stable", "declining"]
ConfidenceLabel = Literal["high", "medium", "low"]
PlantStatus = Literal["healthy", "watch", "sick", "critical", "dead", "replaced"]
PlantSeverityLabel = Literal["healthy", "watch", "sick", "critical", "dead"]
PlantRecoverabilityLabel = Literal["recoverable", "unrecoverable"]
PlantRecommendedAction = Literal["monitor", "treat", "replace"]


# ── AIDecision sub-models ─────────────────────────────────────────────────────

class RecommendedAction(BaseModel):
    actionId: str
    actionType: ActionType
    urgency: UrgencyLevel
    targetZoneId: Optional[str] = None
    description: str
    parameterChanges: dict[str, float]
    nutritionImpact: str
    tradeoff: str


class NutritionSnapshot(BaseModel):
    caloricCoveragePercent: float
    proteinCoveragePercent: float
    nutritionalCoverageScore: float
    daysSafe: float


class BeforeAfterDelta(BaseModel):
    caloricCoverageDelta: float
    proteinCoverageDelta: float
    scoreDelta: float
    daysSafeDelta: float


class BeforeAfterComparison(BaseModel):
    before: NutritionSnapshot
    after: NutritionSnapshot
    delta: BeforeAfterDelta
    summary: str


class AIDecision(BaseModel):
    decisionId: str
    missionDay: int
    timestamp: str
    riskLevel: RiskLevel
    riskSummary: str
    criticalNutrientDependencies: list[str]
    nutritionPreservationMode: bool
    recommendedActions: list[RecommendedAction]
    comparison: BeforeAfterComparison
    explanation: str
    triggeredByScenario: Optional[str]
    kbContextUsed: bool


# ── MissionState sub-models ───────────────────────────────────────────────────

class ZoneSensors(BaseModel):
    temperature: float
    humidity: float
    co2Ppm: float
    lightPAR: float
    photoperiodHours: float
    nutrientPH: float
    electricalConductivity: float
    soilMoisture: float


class StressState(BaseModel):
    active: bool
    type: StressType
    severity: StressSeverity
    boltingRisk: bool
    symptoms: list[str]


class CropZone(BaseModel):
    zoneId: str
    cropType: str
    areaM2: float
    growthDay: int
    growthCycleTotal: int
    growthProgressPercent: float
    status: ZoneStatus
    sensors: ZoneSensors
    stress: StressState
    projectedYieldKg: float
    allocationPercent: float


class PlantRecord(BaseModel):
    plantId: str
    zoneId: str
    rowNo: int
    plantNo: int
    cropType: str
    plantedAt: str
    currentStatus: PlantStatus


class PlantHealthCheck(BaseModel):
    checkId: str
    plantId: str
    capturedAt: str
    imageUri: str
    colorStressScore: float
    wiltingScore: float
    lesionScore: float
    growthDeclineScore: float
    severityLabel: PlantSeverityLabel
    recoverabilityLabel: PlantRecoverabilityLabel
    recommendedAction: PlantRecommendedAction


class ResourceState(BaseModel):
    waterReservoirL: float
    waterRecyclingEfficiency: float
    waterDailyConsumptionL: float
    waterDaysRemaining: float
    energyAvailableKwh: float
    energyConsumptionKwhPerDay: float
    solarGenerationKwhPerDay: float
    energyDaysRemaining: float
    nutrientN: float
    nutrientP: float
    nutrientK: float


class MicronutrientStatus(BaseModel):
    produced: float
    target: float
    unit: str
    coveragePercent: float


class NutritionStatus(BaseModel):
    dailyCaloriesProduced: float
    dailyCaloriesTarget: float
    caloricCoveragePercent: float
    dailyProteinG: float
    dailyProteinTarget: float
    proteinCoveragePercent: float
    vitaminA: MicronutrientStatus
    vitaminC: MicronutrientStatus
    vitaminK: MicronutrientStatus
    folate: MicronutrientStatus
    iron: MicronutrientStatus
    potassium: MicronutrientStatus
    magnesium: MicronutrientStatus
    nutritionalCoverageScore: float
    daysSafe: float
    trend: NutritionTrend


class FailureScenario(BaseModel):
    scenarioId: str
    scenarioType: str
    severity: str
    injectedAt: str
    affectedZones: list[str]
    parameterOverrides: dict[str, float]
    description: str


class EventLogEntry(BaseModel):
    eventId: str
    missionDay: int
    timestamp: str
    type: str
    message: str
    zoneId: Optional[str] = None


class MissionState(BaseModel):
    missionId: str
    missionDay: int
    missionDurationTotal: int
    crewSize: int
    status: MissionStatus
    zones: list[CropZone]
    plants: list[PlantRecord]
    plantHealthChecks: list[PlantHealthCheck]
    resources: ResourceState
    nutrition: NutritionStatus
    activeScenario: Optional[FailureScenario]
    eventLog: list[EventLogEntry]
    lastUpdated: str


# ── PlannerOutput ─────────────────────────────────────────────────────────────

class SimulationChange(BaseModel):
    field: str
    previousValue: Any
    newValue: Any
    reason: str


class StressFlag(BaseModel):
    zoneId: str
    stressType: str
    severity: str
    detectedAt: str
    rule: str


class PlannerOutput(BaseModel):
    missionState: MissionState
    changes: list[SimulationChange]
    nutritionRiskDetected: bool
    stressFlags: list[StressFlag]


# ── ScenarioCatalogEntry ──────────────────────────────────────────────────────

class ScenarioCatalogEntry(BaseModel):
    scenarioType: str
    label: str
    description: str
    defaultSeverityEffects: dict[str, dict[str, float]]
    affectedResources: list[str]
    nutritionRisk: str


# ── AI Service request/response models ───────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request body for POST /ai/analyze"""
    focus: Optional[Literal["mission_overview", "nutrition_risk", "scenario_response"]] = "mission_overview"
    autoApply: bool = False


class PlantAnalyzeRequest(BaseModel):
    plantId: str = Field(..., min_length=1, max_length=128)


class PlantDecisionResponse(BaseModel):
    decisionId: str
    plantId: str
    zoneId: str
    severityLabel: PlantSeverityLabel
    recoverabilityLabel: PlantRecoverabilityLabel
    recommendedAction: PlantRecommendedAction
    decision: Literal["keep", "replace"]
    targetStatus: Literal["watch", "critical"]
    summary: str
    logMessage: str


class ChatRequest(BaseModel):
    """Request body for POST /ai/chat"""
    question: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    """Response from POST /ai/chat — mirrors frontend-handoff contract"""
    answer: str
    relevantSection: Optional[str] = None
    supportingFacts: list[str] = Field(default_factory=list)
    suggestedActions: list[str] = Field(default_factory=list)
    followUpQuestions: list[str] = Field(default_factory=list)
    confidence: ConfidenceLabel = "high"
