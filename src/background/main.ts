import browser from 'webextension-polyfill';
import { BD_MSG } from '../common/messages';
import { SessionService } from './services/session-service';
import { OptionsService } from './services/options-service';
import { RouteService } from './services/route-service';
import { AnalysisService } from './services/analysis-service';

const sessionService = new SessionService();
const optionsService = new OptionsService();
const routeService = new RouteService();
const analysisService = new AnalysisService(routeService, optionsService);

browser.runtime.onMessage.addListener(async (msg: any) => {
  if (!msg?.type) return;
  switch (msg.type) {
    case BD_MSG.OPEN_ANALYSIS:
      return sessionService.createSession(msg.selection);
    case BD_MSG.GET_ANALYSIS_SELECTION:
      return sessionService.getSession(msg.token);
    case BD_MSG.CLEANUP_SESSION:
      return sessionService.cleanupSession(msg.token);
    case BD_MSG.GET_OPTIONS:
      return optionsService.getOptions();
    case BD_MSG.SET_OPTIONS:
      return optionsService.setOptions(msg.options);
    case BD_MSG.FETCH_ROUTE_ONLY:
      return routeService.fetchRoute(msg.token, sessionService, optionsService);
    case BD_MSG.START_ANALYSIS:
      return analysisService.startAnalysis(msg.token, msg.options, sessionService);
  }
});

// Streaming progress via long-lived Port
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== 'analysis') return;
  port.onMessage.addListener(async (msg) => {
    if (msg?.type === 'register-port' && typeof msg.token === 'string') {
      await sessionService.registerPort(msg.token, port);
    }
  });
  port.onDisconnect.addListener(() => {
    sessionService.unregisterPort(port);
  });
});
