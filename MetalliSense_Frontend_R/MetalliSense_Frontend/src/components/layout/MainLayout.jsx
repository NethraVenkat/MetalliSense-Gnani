import React, { Suspense, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Joyride from "react-joyride";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import PushToTalk from '../voice/PushToTalk';
import VoiceErrorBoundary from '../voice/VoiceErrorBoundary';
import {VoicePageProvider} from '../../context/VoicePageContext';
import {voiceEverywhereEnabled} from '../../services/voicePages';
import {useVoicePage} from '../../context/VoicePageContext';
import useSpeak,{useVoiceLanguage} from '../../hooks/useSpeak';
import useVoiceTour from '../../hooks/useVoiceTour';
import VoiceTourCard from '../voice/VoiceTourCard';
import TourSpotlight from '../voice/TourSpotlight';
import useTourMicrophone from '../../hooks/useTourMicrophone';


const pageTitles = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/anomaly": "Composition Deviation Analysis",
  "/recommendation": "Melt Correction Planner",
  "/rl-optimizer": "Adaptive Strategy Optimizer",
  "/full-analysis": "Full Analysis",
  "/mechanical-properties": "Mechanical Properties",
  "/agent": "AI Agent Analysis",
  "/grades": "Grade Specifications",
  "/synthetic": "Synthetic Data Generator",
  "/spectrometer": "Spectrometer Readings",
  "/training-data": "Training Data Management",
  "/raw-material-stock": "Raw Material Stock",
  "/yard-inspection": "Yard Inspection (XRF / LIBS)",
  "/premelt-gate": "Pre-Melt Gate",
  "/supplier-scorecard": "Supplier Scorecard",
  "/energy": "Energy per Heat",
  "/inventory-forecast": "Inventory Forecast",
  "/sales": "Sales & Dispatch",
};

const LayoutBody = () => {
  const location = useLocation();
  const navigate=useNavigate();
  const pageContext=useVoicePage();
  const [lang,setLang]=useVoiceLanguage();
  const {speak,muted}=useSpeak();
  const voiceTour=useVoiceTour({pageContext,navigate,speak,muted,lang});
  const tourMicrophone=useTourMicrophone({tour:voiceTour,lang,scope:pageContext?.scope});
  const title = pageTitles[location.pathname] || "MetalliSense";
  const [runTour, setRunTour] = useState(false);
  const tourSteps = [
    {
      target: "body",
      content: (
        <div>
          <h2 className="text-2xl font-bold mb-3">
            Welcome to MetalliSense! 
          </h2>
          <p className="text-metal-600">
            MetalliSense is an industrial-grade metal analysis and quality
            control system that integrates with OPC UA servers for real-time
            spectrometer readings.
          </p>
        </div>
      ),
      placement: "center",
    },
    {
      target: '[data-tour="sidebar"]',
      content:
        "Use this sidebar to navigate between different sections of the application. Operations are organized into Core, AI & Analytics, and Data Management categories.",
    },
    {
      target: '[data-tour="opc-status"]',
      content:
        "Monitor your OPC server connection status here. The indicator updates in real-time and shows connection details.",
    },
    {
      target: '[data-tour="dashboard-stats"]',
      content:
        "View key metrics and statistics about your metal analysis operations, including readings, grades, and anomalies detected.",
    },
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if (status === "finished" || status === "skipped") {
      setRunTour(false);
      localStorage.setItem("onboardTourCompleted", "true");
    }
  };

  return (
    <div className="flex min-w-0 h-screen bg-gradient-to-br from-metal-50 via-metal-100 to-primary-50">
      {!voiceTour.visible&&<Joyride
        steps={tourSteps}
        run={voiceTour.visible?Boolean(voiceTour.state.active&&voiceTour.state.ready&&!voiceTour.state.targetMissing):runTour}
        disableScrolling={voiceTour.visible}
        continuous={!voiceTour.visible}
        showProgress={!voiceTour.visible}
        showSkipButton={!voiceTour.visible}
        spotlightClicks={voiceTour.visible}
        disableOverlayClose={voiceTour.visible}
        disableCloseOnEsc={voiceTour.visible}
        callback={voiceTour.visible?()=>{}:handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: "#15c26b",
            zIndex: 10000,
          },
          spotlight:{borderRadius:14,boxShadow:'0 0 0 2px rgba(5,150,105,.68)'},
          tooltip:{maxWidth:'calc(100vw - 24px)',padding:0,borderRadius:16},
        }}
      />}
      {voiceTour.visible&&voiceTour.state.active&&voiceTour.state.ready&&!voiceTour.state.targetMissing&&<TourSpotlight target={voiceTour.state.step.id==='handover'?voiceTour.state.step.target:'[data-tour="page-shell"]'} layoutKey={location.key} />}
      <Sidebar setRunTour={setRunTour} onStartTour={voiceTour.visible?()=>voiceTour.control('start',lang):undefined} />
      <div data-tour="page-shell" className={`flex min-w-0 flex-1 flex-col overflow-hidden ${voiceTour.state.active?'md:ml-72':'ml-72'}`}>
        <TopBar title={title} tourGuide={voiceTour.visible&&voiceTour.state.active?<VoiceTourCard
          state={voiceTour.state} control={voiceTour.control}
          microphone={tourMicrophone}
          onResumeAutoplay={()=>voiceTour.control('resume-autoplay')}
          onLanguageChange={value=>{setLang(value);voiceTour.control('language',value);}}
          style={{position:'relative',width:'100%',boxSizing:'border-box',zIndex:10002}}
        />:null}/>
        <main onPointerDownCapture={event=>{const node=event.currentTarget;if(voiceTour.state.active&&node.scrollHeight>node.clientHeight&&event.clientX>=node.getBoundingClientRect().right-20)voiceTour.control('user-scroll');}} onWheelCapture={()=>voiceTour.state.active&&voiceTour.control('user-scroll')} onTouchMoveCapture={()=>voiceTour.state.active&&voiceTour.control('user-scroll')} onKeyDownCapture={event=>{if(voiceTour.state.active&&['PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(event.key)&&!event.target.closest('button,select,input,textarea'))voiceTour.control('user-scroll');}} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
          {voiceEverywhereEnabled() && <VoiceErrorBoundary><PushToTalk shared tour={voiceTour} hidden={voiceTour.state.active} /></VoiceErrorBoundary>}
          <Suspense fallback={<div role="status" className="p-6">Loading page...</div>}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
};

export default function MainLayout() {
  return voiceEverywhereEnabled()?<VoicePageProvider><LayoutBody /></VoicePageProvider>:<LayoutBody />;
}
