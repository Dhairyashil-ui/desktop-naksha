import React, { useState, useEffect } from 'react';
import { SurveyHeader, SurveyStep } from './components/survey/SurveyHeader';
import { AssignedParcelsScreen } from './components/survey/AssignedParcelsScreen';
import { InputsDeckScreen } from './components/survey/InputsDeckScreen';
import { ValidationStageScreen } from './components/survey/ValidationStageScreen';
import { ConstructionScreen } from './components/survey/ConstructionScreen';
import { Property3DScreen } from './components/survey/Property3DScreen';
import { ReportScreen } from './components/survey/ReportScreen';
import { UlpinScreen } from './components/survey/UlpinScreen';
import { PropertyCardScreen } from './components/survey/PropertyCardScreen';
import { CompleteScreen } from './components/survey/CompleteScreen';
import { CategoryUploadScreen } from './components/CategoryUploadScreen';
import { DatasetScannerScreen } from './components/DatasetScannerScreen';
import { 
  AssignedParcel, 
  SurveyReportData,
  StrataUnitData 
} from './services/surveyApi';
import { logCadastralStep } from './utils/systemBootLogger';

export const App: React.FC = () => {
  // Master Guided 9-Step Survey Team Flow
  const [currentStep, setCurrentStep] = useState<SurveyStep>('PARCEL');
  const [activeParcel, setActiveParcel] = useState<AssignedParcel | null>(null);

  // Live Technical Console Process Logging on step transition
  useEffect(() => {
    const stepTitles: Record<SurveyStep, string> = {
      PARCEL: 'STEP 1: ASSIGNED PARCELS REGISTRY',
      INPUTS: 'STEP 2: 10 PPCRC INGESTION CHANNELS',
      VALIDATION: 'STEP 3: 7-TIER CADASTRAL GATEKEEPER VALIDATION',
      CONSTRUCTION: 'STEP 4: 7-STAGE 3D BUILDING RECONSTRUCTION PIPELINE',
      PROPERTY: 'STEP 5: 3D PROPERTY VIEWER & BIM STRATA UNITS',
      REPORT: 'STEP 6: CADASTRAL COMPLIANCE & SURVEY REPORT',
      ULPIN: 'STEP 7: 14-DIGIT BHU-AADHAAR & 3D STRATA ALLOCATION',
      PROPERTY_CARD: 'STEP 8: DIGITAL PROPERTY CARD & DEED GENERATION',
      COMPLETE: 'STEP 9: SURVEY CERTIFICATION & WORKFLOW SIGN-OFF'
    };
    logCadastralStep(stepTitles[currentStep] || currentStep, `Active execution stage: ${currentStep}`, activeParcel ? {
      'Survey Number': `${activeParcel.surveyNumber}/${activeParcel.subDivision}`,
      'Location': activeParcel.location,
      'Base ULPIN': activeParcel.baseUlpin,
      'CRS': 'EPSG:32643 (UTM 43N)',
      'Status': 'ACTIVE & SYNCHRONIZED'
    } : {
      'Registry': 'Survey of India / MH-State Spatial Base',
      'CRS': 'EPSG:32643 (UTM 43N)',
      'Status': 'STANDBY • READY'
    });
  }, [currentStep, activeParcel]);

  // Subflow Modal / Subview State for Upload & Scanner within Step 2
  const [subflowState, setSubflowState] = useState<'NONE' | 'UPLOAD' | 'SCANNER'>('NONE');
  const [uploadTarget, setUploadTarget] = useState<{ 
    num: string; 
    name: string; 
    categoryId: string; 
    datasetId?: string 
  }>({
    num: '01',
    name: 'Photogrammetry',
    categoryId: 'CAT_01_PHOTOGRAMMETRY'
  });

  // State carrying survey deliverables through the pipeline
  const [surveyReport, setSurveyReport] = useState<SurveyReportData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<StrataUnitData | null>(null);
  const [ulpinData, setUlpinData] = useState<{ baseUlpin: string; ulpin3d: string; unitId?: string }>({
    baseUlpin: '27-07-005-020401',
    ulpin3d: '27-07-005-020401-F00-001'
  });

  // 1. OPEN Parcel Action
  const handleOpenParcel = (parcel: AssignedParcel) => {
    setActiveParcel(parcel);
    setSelectedUnit(null);
    setUlpinData({
      baseUlpin: parcel.baseUlpin,
      ulpin3d: `${parcel.baseUlpin}-F00-001`
    });
    setCurrentStep('INPUTS');
  };

  // 2. Open Real File Uploader
  const handleOpenUpload = (num: string, name: string, categoryId: string, datasetId?: string) => {
    setUploadTarget({ num, name, categoryId, datasetId });
    setSubflowState('UPLOAD');
  };

  // 2b. Open Real SSE File Scanner
  const handleOpenScanner = (num: string, name: string, categoryId: string, datasetId?: string) => {
    setUploadTarget({ num, name, categoryId, datasetId });
    setSubflowState('SCANNER');
  };

  // Dataset Saved Callback from Real Upload Screen
  const handleDatasetSaved = (_catNum: string, datasetInfo: any) => {
    if (datasetInfo?.dataset_id) {
      setUploadTarget(prev => ({ ...prev, datasetId: datasetInfo.dataset_id }));
      setSubflowState('SCANNER');
    } else {
      setSubflowState('NONE');
    }
  };

  // Scanner Finished Callback
  const handleFinishScan = () => {
    setSubflowState('NONE');
  };

  // Render the Guided Step
  const renderActiveStep = () => {
    // Subview: Real Category Upload
    if (subflowState === 'UPLOAD' && activeParcel) {
      return (
        <CategoryUploadScreen
          categoryName={uploadTarget.name}
          categoryNum={uploadTarget.num}
          categoryId={uploadTarget.categoryId}
          acceptedFormats="JPG • LAS • SHP • CSV • TIFF • DWG"
          projectId={activeParcel.projectId || activeParcel.id}
          onBack={() => setSubflowState('NONE')}
          onDatasetSaved={handleDatasetSaved}
        />
      );
    }

    // Subview: Real SSE Dataset Scanner
    if (subflowState === 'SCANNER' && activeParcel) {
      return (
        <DatasetScannerScreen
          datasetId={uploadTarget.datasetId}
          projectId={activeParcel.projectId || activeParcel.id}
          categoryName={uploadTarget.name.toUpperCase()}
          onFinishScan={handleFinishScan}
          onBack={() => setSubflowState('NONE')}
        />
      );
    }

    // Step 1: ASSIGNED PARCEL
    if (currentStep === 'PARCEL' || !activeParcel) {
      return <AssignedParcelsScreen onOpenParcel={handleOpenParcel} />;
    }

    // Step 2: INPUTS
    if (currentStep === 'INPUTS') {
      return (
        <InputsDeckScreen
          parcel={activeParcel}
          onBack={() => setCurrentStep('PARCEL')}
          onOpenUpload={handleOpenUpload}
          onOpenScanner={handleOpenScanner}
          onStartConstruction={() => setCurrentStep('VALIDATION')}
        />
      );
    }

    // Step 3: VALIDATION
    if (currentStep === 'VALIDATION') {
      return (
        <ValidationStageScreen
          parcel={activeParcel}
          onFixData={() => setCurrentStep('INPUTS')}
          onStartConstruction={() => setCurrentStep('CONSTRUCTION')}
        />
      );
    }

    // Step 4: 3D CONSTRUCTION
    if (currentStep === 'CONSTRUCTION') {
      return (
        <ConstructionScreen
          parcel={activeParcel}
          onViewProperty={() => setCurrentStep('PROPERTY')}
        />
      );
    }

    // Step 5: 3D PROPERTY
    if (currentStep === 'PROPERTY') {
      return (
        <Property3DScreen
          parcel={activeParcel}
          onGenerateReport={(unit) => {
            if (unit) setSelectedUnit(unit);
            setCurrentStep('REPORT');
          }}
        />
      );
    }

    // Step 6: REPORT
    if (currentStep === 'REPORT') {
      return (
        <ReportScreen
          parcel={activeParcel}
          onSendToBhuNaksha={(rep) => {
            setSurveyReport(rep);
            setCurrentStep('ULPIN');
          }}
        />
      );
    }

    // Step 7: ULPIN / BHU-NAKSHA
    if (currentStep === 'ULPIN') {
      return (
        <UlpinScreen
          parcel={activeParcel}
          report={surveyReport || {
            reportId: `REP-${activeParcel.surveyNumber}`,
            projectCode: activeParcel.projectCode || 'MH-PUN-2026-VIL04',
            surveyNumber: activeParcel.surveyNumber,
            location: activeParcel.location,
            targetCrs: 'EPSG:32643',
            legalAreaSqm: activeParcel.legalAreaSqm,
            gisAreaSqm: activeParcel.gisAreaSqm,
            buildingCount: 1,
            floorsCount: activeParcel.floorsCount || (activeParcel.legalAreaSqm > 1400 ? 4 : 3),
            unitsCount: (activeParcel.floorsCount || (activeParcel.legalAreaSqm > 1400 ? 4 : 3)) * (activeParcel.legalAreaSqm > 1200 ? 4 : 3),
            gnssAccuracyM: 0.015,
            validationStatus: '100% CADASTRALLY CERTIFIED',
            timestamp: new Date().toISOString()
          }}
          initialUnit={selectedUnit}
          onCreatePropertyCard={(data) => {
            setUlpinData(data);
            setCurrentStep('PROPERTY_CARD');
          }}
        />
      );
    }

    // Step 8: PROPERTY CARD
    if (currentStep === 'PROPERTY_CARD') {
      return (
        <PropertyCardScreen
          parcel={activeParcel}
          baseUlpin={ulpinData.baseUlpin}
          ulpin3d={ulpinData.ulpin3d}
          initialUnitId={ulpinData.unitId || selectedUnit?.id}
          onProceedToComplete={() => setCurrentStep('COMPLETE')}
        />
      );
    }

    // Step 9: COMPLETE
    if (currentStep === 'COMPLETE') {
      return (
        <CompleteScreen
          parcel={activeParcel}
          baseUlpin={ulpinData.baseUlpin}
          ulpin3d={ulpinData.ulpin3d}
          onViewPropertyCard={() => setCurrentStep('PROPERTY_CARD')}
          onDone={() => {
            setActiveParcel(null);
            setCurrentStep('PARCEL');
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen w-screen bg-white text-zinc-900 font-sans antialiased overflow-x-hidden flex flex-col">
      {/* Top Survey Workflow Stepper Header */}
      <SurveyHeader
        currentStep={currentStep}
        activeParcel={activeParcel}
        onResetToParcels={() => {
          setSubflowState('NONE');
          setCurrentStep('PARCEL');
        }}
      />

      {/* Main Flow Viewport */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {renderActiveStep()}
      </main>
    </div>
  );
};

export default App;
