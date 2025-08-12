// Background main: service wiring and message routing
// Assumes classes are defined in the concatenated bundle before this file.

(function () {
  const browser = self.browser || self.chrome;

  const sessionService = new SessionService();
  const optionsService = new OptionsService();
  const routeService = new RouteService();
  const analysisService = new AnalysisService(routeService, optionsService);

  browser.runtime.onMessage.addListener(async (msg, sender) => {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case (self.BD_MSG && self.BD_MSG.OPEN_ANALYSIS) || 'open-analysis':
        return sessionService.createSession(msg.selection);

      case (self.BD_MSG && self.BD_MSG.GET_ANALYSIS_SELECTION) || 'get-analysis-selection':
        return sessionService.getSession(msg.token);

      case (self.BD_MSG && self.BD_MSG.CLEANUP_SESSION) || 'cleanup-session':
        return sessionService.cleanupSession(msg.token);

      case (self.BD_MSG && self.BD_MSG.GET_OPTIONS) || 'get-options':
        return optionsService.getOptions();

      case (self.BD_MSG && self.BD_MSG.SET_OPTIONS) || 'set-options':
        return optionsService.setOptions(msg.options);

      case (self.BD_MSG && self.BD_MSG.FETCH_ROUTE_ONLY) || 'fetch-route-only':
        return routeService.fetchRoute(msg.token, sessionService, optionsService);

      case (self.BD_MSG && self.BD_MSG.START_ANALYSIS) || 'start-analysis':
        return analysisService.startAnalysis(msg.token, msg.options, sessionService);
    }
  });
})();

