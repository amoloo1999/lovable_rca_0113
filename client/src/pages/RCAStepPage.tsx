import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BarChart3, Home, RotateCcw } from "lucide-react";
import { toast } from 'sonner';
import { useRCAWizard, WIZARD_STEPS } from "@/hooks/useRCAWizard";
import { WizardProgress } from "@/components/rca/WizardProgress";
import { StepSearch } from "@/components/rca/StepSearch";
import { StepSubjectStore } from "@/components/rca/StepSubjectStore";
import { StepCompetitors } from "@/components/rca/StepCompetitors";
import { StepMetadata } from "@/components/rca/StepMetadata";
import { StepRankings } from "@/components/rca/StepRankings";
import { StepAdjustments } from "@/components/rca/StepAdjustments";
import { StepNames } from "@/components/rca/StepNames";
import { StepDataGaps } from "@/components/rca/StepDataGaps";
import { StepFeatureCodes } from "@/components/rca/StepFeatureCodes";
import { StepDataVisualization } from "@/components/rca/StepDataVisualization";
import { startKeepalive, stopKeepalive, setupActivityTracking } from "@/lib/keepalive";
import { clearWizardState, hasSavedState } from "@/lib/wizardStorage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function RCAStepPage() {
  const { step } = useParams<{ step: string }>();
  const navigate = useNavigate();
  const stepNumber = parseInt(step || '1', 10);
  
  const { state, actions } = useRCAWizard(stepNumber);

  // Set up keepalive and activity tracking to prevent timeout
  useEffect(() => {
    startKeepalive();
    const cleanupActivity = setupActivityTracking();
    
    return () => {
      stopKeepalive();
      cleanupActivity();
    };
  }, []);

  // Show notification if we're recovering from saved state
  useEffect(() => {
    if (hasSavedState() && stepNumber === 1) {
      toast.info('Your previous progress has been restored', {
        duration: 4000,
      });
    }
  }, []);

  // Sync URL with current step
  useEffect(() => {
    if (state.currentStep !== stepNumber) {
      actions.setStep(stepNumber);
    }
  }, [stepNumber, state.currentStep, actions]);

  // Navigate to next step
  const goToNextStep = () => {
    const nextStep = Math.min(state.currentStep + 1, WIZARD_STEPS.length);
    navigate(`/rca/step/${nextStep}`);
  };

  // Navigate to previous step
  const goToPrevStep = () => {
    const prevStep = Math.max(state.currentStep - 1, 1);
    navigate(`/rca/step/${prevStep}`);
  };

  // Start a new analysis
  const handleNewAnalysis = () => {
    clearWizardState();
    navigate('/rca/step/1');
    window.location.reload(); // Force full reload to reset state
  };

  const renderStep = () => {
    switch (stepNumber) {
      case 1:
        return (
          <StepSearch
            criteria={state.searchCriteria}
            onUpdate={actions.updateSearchCriteria}
            onSearch={async () => {
              await actions.searchStores();
              goToNextStep();
            }}
            isLoading={state.isLoading}
          />
        );
      case 2:
        return (
          <StepSubjectStore
            stores={state.searchResults}
            selectedStore={state.subjectStore}
            onSelect={async (store) => {
              await actions.selectSubjectStore(store);
            }}
            onNext={goToNextStep}
            isLoading={state.isLoading}
          />
        );
      case 3:
        return (
          <StepCompetitors
            subjectStore={state.subjectStore!}
            competitors={state.competitors}
            onSelect={actions.selectStoresForAnalysis}
            onNext={goToNextStep}
            onBack={goToPrevStep}
            isLoading={state.isLoading}
          />
        );
      case 4:
        return (
          <StepMetadata
            stores={state.selectedStores}
            metadata={state.storeMetadata}
            onUpdate={actions.updateStoreMetadata}
            onNext={goToNextStep}
            onBack={goToPrevStep}
            onFetchMatches={actions.fetchSalesforceMatchesForStore}
          />
        );
      case 5:
        return (
          <StepRankings
            stores={state.selectedStores}
            rankings={state.storeRankings}
            metadata={state.storeMetadata}
            onUpdate={actions.updateStoreRankings}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        );
      case 6:
        return (
          <StepAdjustments
            factors={state.adjustmentFactors}
            onUpdate={actions.updateAdjustmentFactors}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        );
      case 7:
        return (
          <StepNames
            stores={state.selectedStores}
            customNames={state.customNames}
            onUpdate={actions.updateCustomName}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        );
      case 8:
        return (
          <StepDataGaps
            gaps={state.dateGaps}
            selectedApiStores={state.apiStoreIds}
            onSetApiStores={actions.setApiStoreIds}
            onAnalyze={actions.analyzeGaps}
            isLoading={state.isLoading}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        );
      case 9:
        return (
          <StepFeatureCodes
            featureCodes={state.featureCodes}
            onUpdate={actions.updateFeatureCode}
            onInitialize={actions.initializeFeatureCodes}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        );
      case 10:
        return (
          <StepDataVisualization
            subjectStore={state.subjectStore}
            selectedStores={state.selectedStores}
            storeMetadata={state.storeMetadata}
            storeRankings={state.storeRankings}
            adjustmentFactors={state.adjustmentFactors}
            rateRecords={state.rateRecords}
            customNames={state.customNames}
            featureCodes={state.featureCodes}
            onExport={actions.exportCSV}
            isLoading={state.isLoading}
            onBack={goToPrevStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">
                  Rate Comparison Analysis
                </h1>
                <p className="text-sm text-muted-foreground">
                  Step {stepNumber} of {WIZARD_STEPS.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    New Analysis
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start New Analysis?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your current progress and start a fresh analysis. 
                      Make sure you've exported any data you need before proceeding.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleNewAnalysis}>
                      Start New
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <WizardProgress 
            steps={WIZARD_STEPS} 
            currentStep={stepNumber}
            onStepClick={(step) => navigate(`/rca/step/${step}`)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {renderStep()}
      </main>
    </div>
  );
}
