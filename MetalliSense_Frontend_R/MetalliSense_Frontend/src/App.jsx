import React, { lazy, Suspense } from "react";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { OPCProvider } from "./context/OPCContext";
import { GradeProvider } from "./context/GradeContext";
import { MeltFlowProvider } from "./context/MeltFlowContext";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnomalyDetection = lazy(() => import("./pages/AnomalyDetection"));
const Recommendation = lazy(() => import("./pages/Recommendation"));
const RLOptimizer = lazy(() => import("./pages/RLOptimizer"));
const AIAgent = lazy(() => import("./pages/AIAgent"));
const GradeSpecs = lazy(() => import("./pages/GradeSpecs"));
const SyntheticData = lazy(() => import("./pages/SyntheticData"));
const Spectrometer = lazy(() => import("./pages/Spectrometer"));
const TrainingData = lazy(() => import("./pages/TrainingData"));
const SemanticSearch = lazy(() => import("./pages/SemanticSearch"));
const CostAnalysis = lazy(() => import("./pages/CostAnalysis"));
const FullAnalysis = lazy(() => import("./pages/FullAnalysis"));
const RawMaterialStock = lazy(() => import("./pages/RawMaterialStock"));
const YardInspection = lazy(() => import("./pages/YardInspection"));
const PreMeltGate = lazy(() => import("./pages/PreMeltGate"));
const SupplierScorecard = lazy(() => import("./pages/SupplierScorecard"));
const EnergyDashboard = lazy(() => import("./pages/EnergyDashboard"));
const InventoryForecast = lazy(() => import("./pages/InventoryForecast"));
const SalesInvoices = lazy(() => import("./pages/SalesInvoices"));
const MechanicalProperties = lazy(() => import("./pages/MechanicalProperties"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/SignUp"));
import "./App.css";

const ChargeOptimizer = import.meta.env.VITE_MOCK_MODE === 'true' ? lazy(() => import('./mock/ChargeOptimizer.jsx')) : null;
const Router = import.meta.env.VITE_MOCK_MODE === 'true' ? HashRouter : BrowserRouter;

function App() {
  return (
    <Router>
      <AuthProvider>
        <OPCProvider>
          <MeltFlowProvider>
      <GradeProvider>
            <div className="App">
              <Suspense fallback={<div className="p-6">Loading…</div>}><Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="anomaly" element={<AnomalyDetection />} />
                  <Route path="recommendation" element={<Recommendation />} />
                  <Route path="rl-optimizer" element={<RLOptimizer />} />
                  <Route path="agent" element={<AIAgent />} />
                  <Route path="grades" element={<GradeSpecs />} />
                  <Route path="synthetic" element={<SyntheticData />} />
                  <Route path="spectrometer" element={<Spectrometer />} />
                  <Route path="training-data" element={<TrainingData />} />
                  <Route path="semantic-search" element={<SemanticSearch />} />
                  <Route path="cost-analysis" element={<CostAnalysis />} />
                  <Route path="full-analysis" element={<FullAnalysis />} />
                  <Route path="mechanical-properties" element={<MechanicalProperties />} />
                  <Route path="raw-material-stock" element={<RawMaterialStock />} />
                  <Route path="yard-inspection" element={<YardInspection />} />
                  <Route path="premelt-gate" element={<PreMeltGate />} />
                  <Route path="supplier-scorecard" element={<SupplierScorecard />} />
                  <Route path="energy" element={<EnergyDashboard />} />
                  <Route path="inventory-forecast" element={<InventoryForecast />} />
                  <Route path="sales" element={<SalesInvoices />} />
                  {ChargeOptimizer && <Route path="charge-optimizer" element={<ChargeOptimizer />} />}
                </Route>
              </Routes></Suspense>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#fff",
                    color: "#0f172a",
                    border: "1px solid #e2e8f0",
                  },
                  success: {
                    iconTheme: {
                      primary: "#22c55e",
                      secondary: "#fff",
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: "#ef4444",
                      secondary: "#fff",
                    },
                  },
                }}
              />
            </div>
          </GradeProvider>
      </MeltFlowProvider>
        </OPCProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
