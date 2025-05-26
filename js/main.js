const { jsPDF } = window.jspdf;
if (typeof ChartDataLabels !== 'undefined') { Chart.register(ChartDataLabels); } else { console.error("ChartDataLabels plugin not found."); }

document.addEventListener('DOMContentLoaded', () => {
  const courtArea = document.getElementById('courtArea');
  const svgCourt = document.getElementById('badmintonCourt');
  const markersOverlay = document.getElementById('markersOverlay');
  const scorePlayer1Display = document.getElementById('scorePlayer1');
  const scorePlayer2Display = document.getElementById('scorePlayer2');
  const resetButton = document.getElementById('resetButton');
  const chartPlayer1CanvasEl = document.getElementById('chartPlayer1');
  const chartPlayer2CanvasEl = document.getElementById('chartPlayer2');
  const chartWrapperP1 = document.getElementById('chartWrapperP1');
  const chartWrapperP2 = document.getElementById('chartWrapperP2');
  const chartPlayer1Canvas = chartPlayer1CanvasEl.getContext('2d');
  const chartPlayer2Canvas = chartPlayer2CanvasEl.getContext('2d');
  const cursorP1 = document.getElementById('cursorP1');
  const cursorP2 = document.getElementById('cursorP2');
  const undoButton = document.getElementById('undoButton');
  const playerName1Display = document.getElementById('playerName1');
  const playerName2Display = document.getElementById('playerName2');
  const playerName1Input = document.getElementById('playerNameInput1');
  const playerName2Input = document.getElementById('playerNameInput2');
  const timerDisplay = document.getElementById('timerDisplay');
  const timerStartPauseButton = document.getElementById('timerStartPauseButton');
  const timerResetButton = document.getElementById('timerResetButtonTimer');
  const timerLimitInput = document.getElementById('timerLimitInput');
  const setScorePlayer1Display = document.getElementById('setScorePlayer1');
  const setScorePlayer2Display = document.getElementById('setScorePlayer2');
  const nextSetButton = document.getElementById('nextSetButton');
  const exportPdfButton = document.getElementById('exportPdfButton');
  const chartTitlePlayer1 = document.getElementById('chartTitlePlayer1');
  const chartTitlePlayer2 = document.getElementById('chartTitlePlayer2');

  let gameState = {
    scorePlayer1: 0,
    scorePlayer2: 0,
    setsPlayer1: 0,
    setsPlayer2: 0,
    playerName1: "Joueur 1",
    playerName2: "Joueur 2",
    statistics: {}, // Will be initialized by initializeStats
    actionHistory: [] // Will be managed by saveStateBeforeAction and undoLastAction
  };

  let timerState = {
    interval: null,
    seconds: 0,
    running: false,
    limitSeconds: 0
  };

  let chartInstances = {
    player1: null,
    player2: null
  };

  const MAX_HISTORY_SIZE = 10;
  const LONG_PRESS_DURATION = 500;
  let pressTimer = null;
  let startCoords = null;

  const NET_X = 335; const NET_AREA_LEFT_BOUNDARY = 312.5; const NET_AREA_RIGHT_BOUNDARY = 357.5; const LEFT_SHORT_SERVICE_X = 236; const RIGHT_SHORT_SERVICE_X = 434; const LEFT_SINGLES_BACK_LINE_X = 23; const RIGHT_SINGLES_BACK_LINE_X = 647; const TOP_SINGLES_SIDE_LINE_Y = 23; const BOTTOM_SINGLES_SIDE_LINE_Y = 282; const CENTER_LINE_Y = 152.5; const LEFT_DOUBLES_BACK_LINE_X = 0; const RIGHT_DOUBLES_BACK_LINE_X = 670; const TOP_DOUBLES_SIDE_LINE_Y = 0; const BOTTOM_DOUBLES_SIDE_LINE_Y = 305; const RED_SQUARE_LEFT = { x: 102, y: 85.5, width: 134, height: 134 }; const RED_SQUARE_RIGHT = { x: 434, y: 85.5, width: 134, height: 134 }; const LEFT_BACK_ALLEY_RECT_ZONE = 'LEFT_BACK_ALLEY_RECT'; const RIGHT_BACK_ALLEY_RECT_ZONE = 'RIGHT_BACK_ALLEY_RECT'; const NET_ZONE_LEFT = 'NET_ZONE_LEFT_EXTENDED'; const NET_ZONE_RIGHT = 'NET_ZONE_RIGHT_EXTENDED';

  function updateUndoButtonState() { undoButton.disabled = gameState.actionHistory.length === 0; }
  function saveStateBeforeAction(markerElement, actionType = 'point') { const statsSnapshot = JSON.parse(JSON.stringify(gameState.statistics)); const historyEntry = { scoreP1: gameState.scorePlayer1, scoreP2: gameState.scorePlayer2, setsP1: gameState.setsPlayer1, setsP2: gameState.setsPlayer2, statsSnapshot: statsSnapshot, markerElement: markerElement, actionType: actionType, p1Name: gameState.playerName1, p2Name: gameState.playerName2 }; gameState.actionHistory.push(historyEntry); if (gameState.actionHistory.length > MAX_HISTORY_SIZE) { gameState.actionHistory.shift(); } updateUndoButtonState(); }
  function initializeStats() { gameState.statistics = { rawZones: {}, player1: { hitsReceived: { comfort: 0, validOther: 0, invalid: 0, total: 0 }, impactsMade: { comfort: 0, validOther: 0, invalidFault: 0, total: 0 } }, player2: { hitsReceived: { comfort: 0, validOther: 0, invalid: 0, total: 0 }, impactsMade: { comfort: 0, validOther: 0, invalidFault: 0, total: 0 } }, scoreP1: 0, scoreP2: 0, faultsByP1: 0, faultsByP2: 0, totalHits: 0, totalImpacts: 0 }; }
  function getZoneClassification(x, y) { if (x < LEFT_DOUBLES_BACK_LINE_X || x >= RIGHT_DOUBLES_BACK_LINE_X || y < TOP_DOUBLES_SIDE_LINE_Y || y >= BOTTOM_DOUBLES_SIDE_LINE_Y) return { category: 'invalid', rawZone: 'OUT_OF_BOUNDS_MARGIN', isIn: false }; if (x >= NET_AREA_LEFT_BOUNDARY && x < NET_AREA_RIGHT_BOUNDARY) return { category: 'invalid', rawZone: (x < NET_X) ? NET_ZONE_LEFT : NET_ZONE_RIGHT, isIn: false }; if ((x >= RED_SQUARE_LEFT.x && x < RED_SQUARE_LEFT.x + RED_SQUARE_LEFT.width && y >= RED_SQUARE_LEFT.y && y < RED_SQUARE_LEFT.y + RED_SQUARE_LEFT.height) || (x >= RED_SQUARE_RIGHT.x && x < RED_SQUARE_RIGHT.x + RED_SQUARE_RIGHT.width && y >= RED_SQUARE_RIGHT.y && y < RED_SQUARE_RIGHT.y + RED_SQUARE_RIGHT.height)) return { category: 'comfort', rawZone: 'RED_ZONE', isIn: true }; if (y < TOP_SINGLES_SIDE_LINE_Y || y >= BOTTOM_SINGLES_SIDE_LINE_Y) return { category: 'invalid', rawZone: `${x < NET_X ? 'LEFT' : 'RIGHT'}_SIDE_ALLEY_${y < TOP_SINGLES_SIDE_LINE_Y ? 'TOP' : 'BOTTOM'}`, isIn: false }; if (x >= LEFT_DOUBLES_BACK_LINE_X && x < LEFT_SINGLES_BACK_LINE_X && y >= TOP_SINGLES_SIDE_LINE_Y && y < BOTTOM_SINGLES_SIDE_LINE_Y) return { category: 'validOther', rawZone: LEFT_BACK_ALLEY_RECT_ZONE, isIn: true }; if (x >= RIGHT_SINGLES_BACK_LINE_X && x < RIGHT_DOUBLES_BACK_LINE_X && y >= TOP_SINGLES_SIDE_LINE_Y && y < BOTTOM_SINGLES_SIDE_LINE_Y) return { category: 'validOther', rawZone: RIGHT_BACK_ALLEY_RECT_ZONE, isIn: true }; let rawZoneName = 'UNKNOWN_VALID'; if (x < NET_X) { if (x >= LEFT_SINGLES_BACK_LINE_X && x < LEFT_SHORT_SERVICE_X) rawZoneName = 'LEFT_BACK_COURT'; else if (x >= LEFT_SHORT_SERVICE_X && x < NET_AREA_LEFT_BOUNDARY) rawZoneName = y < CENTER_LINE_Y ? 'LEFT_SERVICE_BOX_TOP' : 'LEFT_SERVICE_BOX_BOTTOM'; } else { if (x >= NET_AREA_RIGHT_BOUNDARY && x < RIGHT_SHORT_SERVICE_X) rawZoneName = y < CENTER_LINE_Y ? 'RIGHT_SERVICE_BOX_TOP' : 'RIGHT_SERVICE_BOX_BOTTOM'; else if (x >= RIGHT_SHORT_SERVICE_X && x < RIGHT_SINGLES_BACK_LINE_X) rawZoneName = 'RIGHT_BACK_COURT'; } if (rawZoneName !== 'UNKNOWN_VALID') return { category: 'validOther', rawZone: rawZoneName, isIn: true }; console.warn("Zone non classifiée trouvée DANS les limites du simple pour coords:", x, y); return { category: 'invalid', rawZone: 'UNKNOWN_INSIDE_SINGLES', isIn: false }; }
  function recordStat(playerContext, eventType, classification) { const { category, rawZone, isIn } = classification; if (!category || !rawZone) { console.error("Stat classification invalide:", classification); return; } const playerStats = (playerContext === 'P1') ? gameState.statistics.player1 : gameState.statistics.player2; const statsBucket = playerStats[eventType]; if (statsBucket) { if (category === 'comfort') statsBucket.comfort++; else if (category === 'validOther') statsBucket.validOther++; else if (category === 'invalid') { if(eventType === 'hitsReceived') statsBucket.invalid++; else statsBucket.invalidFault++; } statsBucket.total++; } else { console.error(`Stats bucket introuvable: ${playerContext} - ${eventType}`); } if (eventType === 'hitsReceived') gameState.statistics.totalHits++; else gameState.statistics.totalImpacts++; if (!gameState.statistics.rawZones[rawZone]) { gameState.statistics.rawZones[rawZone] = { hits: 0, impactsIn: 0, impactsFault: 0 }; } const zoneData = gameState.statistics.rawZones[rawZone]; if (eventType === 'hitsReceived') { zoneData.hits++; } else { if (isIn) zoneData.impactsIn++; else zoneData.impactsFault++; } }
  function initializeCharts() { const chartOptions={responsive:!0,maintainAspectRatio:true,animation:false,plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:function(e){let t=e.label||"";t&&(t+=": ");const a=e.parsed,l=e.dataset.data.reduce((e,t)=>e+t,0),n=l>0?Math.round(a/l*100):0;return t+=`${a} (${n}%)`,t}}},datalabels:{formatter:(e,t)=>{const a=t.chart.data.datasets[0].data.reduce((e,t)=>e+t,0);if(0===a||0===e)return"0%";const l=e/a*100;return l>0.01?l.toFixed(0)+"%":""},color:"#ffffff",font:{weight:"bold"},anchor:"center",align:"center"}}};const labels=["Zone Confort","Zone Excentrée","Hors Limites/Faute"],backgroundColors=["#ff6666","#66cc66","#cccccc"],borderColors=["#ffffff","#ffffff","#ffffff"];chartInstances.player1&&chartInstances.player1.destroy(),chartInstances.player2&&chartInstances.player2.destroy();chartInstances.player1=new Chart(chartPlayer1Canvas,{type:"pie",data:{labels:labels,datasets:[{label:"Joueur 1 - Analyse",data:[0,0,0],backgroundColor:backgroundColors,borderColor:borderColors,borderWidth:1}]},options:chartOptions}),chartInstances.player2=new Chart(chartPlayer2Canvas,{type:"pie",data:{labels:labels,datasets:[{label:"Joueur 2 - Analyse",data:[0,0,0],backgroundColor:backgroundColors,borderColor:borderColors,borderWidth:1}]},options:chartOptions}),updateMasteryGauges(0,0); }
  function updateMasteryGauges(percentP1, percentP2) { if(!cursorP1||!cursorP2)return;function calculateCursorPosition(e){let t=0;return t=e<=20?e/20*25:e<=40?25+(e-20)/20*25:e<=60?50+(e-40)/20*25:75+(e-60)/40*25,Math.min(Math.max(t,2),98)}function calculateCursorPositionMobile(e){let t=0;return t=e<=20?e/20*25:e<=40?25+(e-20)/20*25:e<=60?50+(e-40)/20*25:75+(e-60)/40*25,Math.min(Math.max(t,2),98)}const isMobileView=window.innerWidth<=1100;isMobileView?(cursorP1.style.left=calculateCursorPositionMobile(percentP1)+"%",cursorP2.style.left=calculateCursorPositionMobile(percentP2)+"%",cursorP1.style.bottom="",cursorP2.style.bottom=""):(cursorP1.style.bottom=calculateCursorPosition(percentP1)+"%",cursorP2.style.bottom=calculateCursorPosition(percentP2)+"%",cursorP1.style.left="",cursorP2.style.left=""); }
  function updateCharts() { if(!chartInstances.player1||!chartInstances.player2)return;const dataP1=[gameState.statistics.player2.hitsReceived.comfort+gameState.statistics.player1.impactsMade.comfort,gameState.statistics.player2.hitsReceived.validOther+gameState.statistics.player1.impactsMade.validOther,gameState.statistics.player2.hitsReceived.invalid+gameState.statistics.player1.impactsMade.invalidFault];chartInstances.player1.data.datasets[0].data=dataP1,chartInstances.player1.update('none');const dataP2=[gameState.statistics.player1.hitsReceived.comfort+gameState.statistics.player2.impactsMade.comfort,gameState.statistics.player1.hitsReceived.validOther+gameState.statistics.player2.impactsMade.validOther,gameState.statistics.player1.hitsReceived.invalid+gameState.statistics.player2.impactsMade.invalidFault];chartInstances.player2.data.datasets[0].data=dataP2,chartInstances.player2.update('none');const sumP1=dataP1.reduce((e,t)=>e+t,0),percentExcentreesP1=sumP1>0?dataP1[1]/sumP1*100:0;const sumP2=dataP2.reduce((e,t)=>e+t,0),percentExcentreesP2=sumP2>0?dataP2[1]/sumP2*100:0;updateMasteryGauges(percentExcentreesP1,percentExcentreesP2); }
  function updateScoreDisplay() { scorePlayer1Display.textContent = gameState.scorePlayer1; scorePlayer2Display.textContent = gameState.scorePlayer2; if(setScorePlayer1Display) setScorePlayer1Display.textContent = `(${gameState.setsPlayer1})`; if(setScorePlayer2Display) setScorePlayer2Display.textContent = `(${gameState.setsPlayer2})`; gameState.statistics.scoreP1 = gameState.scorePlayer1; gameState.statistics.scoreP2 = gameState.scorePlayer2; }
  function addVisualMarker(relativeX, relativeY, type) { const marker = document.createElement('div'); marker.classList.add('marker'); if (type === 'hit') marker.classList.add('hit-marker'); else if (type === 'impact-in') marker.classList.add('impact-marker-in'); else marker.classList.add('impact-marker-fault'); marker.style.left = `${relativeX}px`; marker.style.top = `${relativeY}px`; markersOverlay.appendChild(marker); return marker; }
  function handleShortClick(coords) { if (coords.svgX >= NET_AREA_LEFT_BOUNDARY && coords.svgX < NET_AREA_RIGHT_BOUNDARY) { return; } const markerElement = addVisualMarker(coords.relativeX, coords.relativeY, 'hit'); saveStateBeforeAction(markerElement, 'point'); const classification = getZoneClassification(coords.svgX, coords.svgY); const receivingPlayer = (coords.svgX < NET_X) ? 'P1' : 'P2'; recordStat(receivingPlayer, 'hitsReceived', classification); updateCharts(); }
  function handleLongPress(coords) { let pointWinner = null; let faultCommittedBy = null; let markerType = ''; let effectiveIsIn = false; let statClassification; let rawZone; let playerContextForStat = null; if (coords.svgX >= NET_AREA_LEFT_BOUNDARY && coords.svgX < NET_AREA_RIGHT_BOUNDARY) { effectiveIsIn = false; markerType = 'impact-fault'; if (coords.svgX < NET_X) { pointWinner = 'P2'; faultCommittedBy = 'P1'; rawZone = NET_ZONE_LEFT; playerContextForStat = 'P1'; } else { pointWinner = 'P1'; faultCommittedBy = 'P2'; rawZone = NET_ZONE_RIGHT; playerContextForStat = 'P2'; } statClassification = { category: 'invalid', rawZone: rawZone, isIn: false }; } else { const classification = getZoneClassification(coords.svgX, coords.svgY); rawZone = classification.rawZone; effectiveIsIn = classification.isIn; const impactingPlayer = (coords.svgX < NET_X) ? 'P2' : 'P1'; const opponentPlayer = (impactingPlayer === 'P1') ? 'P2' : 'P1'; if (effectiveIsIn) { pointWinner = impactingPlayer; markerType = 'impact-in'; faultCommittedBy = null; } else { faultCommittedBy = impactingPlayer; pointWinner = opponentPlayer; markerType = 'impact-fault'; } statClassification = classification; playerContextForStat = impactingPlayer; } const markerElement = addVisualMarker(coords.relativeX, coords.relativeY, markerType); saveStateBeforeAction(markerElement, 'point'); if (pointWinner === 'P1') { gameState.scorePlayer1++; } else if (pointWinner === 'P2') { gameState.scorePlayer2++; } updateScoreDisplay(); if(playerContextForStat) { recordStat(playerContextForStat, 'impactsMade', statClassification); } else { console.error("Impossible d'enregistrer la stat d'impact: playerContextForStat non défini", coords); } updateCharts(); }
  
  /**
   * Converts client (screen) coordinates to SVG internal coordinates and relative coordinates for marker placement.
   * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
   * @returns {{svgX: number, svgY: number, relativeX: number, relativeY: number}|null} 
   *          An object containing SVG coordinates (svgX, svgY) and 
   *          relative coordinates for marker placement (relativeX, relativeY),
   *          or null if coordinate conversion is not possible.
   */
  function getSVGCoordinates(event) {
    // Determine the correct event object for clientX/clientY based on event type (mouse or touch)
    let sourceEvent = null;
    if (event.touches && event.touches.length > 0) {
      sourceEvent = event.touches[0]; // Use the first touch point
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      sourceEvent = event.changedTouches[0]; // Use the first changed touch point (for touchend)
    } else {
      sourceEvent = event; // Mouse event
    }
  
    // Get clientX and clientY from the determined event source
    const clientX = sourceEvent.clientX;
    const clientY = sourceEvent.clientY;
  
    // Validate that clientX and clientY are numbers
    if (typeof clientX !== 'number' || typeof clientY !== 'number') {
      console.error("Invalid client coordinates:", event);
      return null;
    }
  
    // Get the bounding rectangle of the courtArea (the div containing the SVG)
    const courtAreaRect = courtArea.getBoundingClientRect();
    // Get the bounding rectangle of the SVG element itself
    const svgRect = svgCourt.getBoundingClientRect();
    // Get the viewBox attribute from the SVG element (e.g., "0 0 670 305")
    const viewBox = svgCourt.viewBox.baseVal;
  
    // Check if SVG dimensions or viewBox are valid/ready
    if (!svgRect || svgRect.width === 0 || svgRect.height === 0 || !viewBox) {
      console.error("SVG dimensions or viewBox invalid or not ready:", svgRect, viewBox);
      return null;
    }
  
    // Calculate click coordinates relative to the courtArea container
    const clickXInContainer = clientX - courtAreaRect.left;
    const clickYInContainer = clientY - courtAreaRect.top;
  
    // Calculate the offset of the SVG within the courtArea container
    // This is important if the SVG itself has margins or is not positioned at the top-left of courtArea
    const svgOffsetXInContainer = svgRect.left - courtAreaRect.left;
    const svgOffsetYInContainer = svgRect.top - courtAreaRect.top;
  
    // Calculate click coordinates relative to the SVG element itself (still in screen pixels)
    const clickXInSVGScreen = clickXInContainer - svgOffsetXInContainer;
    const clickYInSVGScreen = clickYInContainer - svgOffsetYInContainer;
  
    // --- Convert screen pixel coordinates within SVG to SVG internal coordinate system ---
    // The SVG might be scaled if its display size (svgRect.width/height) is different from its viewBox definition.
    // Calculate the scaling factor.
    const scaleX = viewBox.width / svgRect.width;
    const scaleY = viewBox.height / svgRect.height;
  
    // Apply scaling and add the viewBox's min-x and min-y offsets.
    // viewBox.x and viewBox.y are typically 0 if the SVG coordinates start at (0,0).
    const svgX = (clickXInSVGScreen * scaleX) + viewBox.x;
    const svgY = (clickYInSVGScreen * scaleY) + viewBox.y;
  
    // --- Calculate relativeX and relativeY for marker placement on markersOverlay ---
    // markersOverlay is positioned absolutely within courtArea, starting at the same top/left as the SVG padding.
    // The current padding of courtArea is 40px.
    // These coordinates are relative to the markersOverlay's top-left corner.
    const overlayPaddingLeft = 40; 
    const overlayPaddingTop = 40;
    // clickXInContainer and clickYInContainer are already relative to courtArea.
    // We subtract the padding to get coordinates relative to the overlay's drawing surface.
    const relativeX = clickXInContainer - overlayPaddingLeft;
    const relativeY = clickYInContainer - overlayPaddingTop;
  
    return { svgX, svgY, relativeX, relativeY };
  }

  function handlePressStart(event) { if(event.type.startsWith("touch"))event.preventDefault();if(!(startCoords=getSVGCoordinates(event)))return console.warn("Coords départ invalides."),void(startCoords=null);clearTimeout(pressTimer),pressTimer=setTimeout(()=>{startCoords&&handleLongPress(startCoords),pressTimer=null,startCoords=null},LONG_PRESS_DURATION); }
  function handlePressEnd(event) { if(event.type.startsWith("touch"))event.preventDefault();if(null!==pressTimer&&startCoords){clearTimeout(pressTimer),pressTimer=null;const e=getSVGCoordinates(event);if(!e)return console.warn("Coords fin invalides."),void(startCoords=null);const t=e.svgX-startCoords.svgX,o=e.svgY-startCoords.svgY;Math.sqrt(t*t+o*o)<10?handleShortClick(e):console.log("Mouvement > 10px (SVG), annulation clic court")}startCoords=null; }
  function handleLeaveOrCancel(event) { pressTimer&&(clearTimeout(pressTimer),pressTimer=null,console.log("Appui annulé (leave/cancel)")),startCoords=null; }
  function undoLastAction() {
    if (gameState.actionHistory.length === 0) {
      console.log("Aucune action à annuler.");
      return;
    }
    const lastState = gameState.actionHistory.pop();
    gameState.scorePlayer1 = lastState.scoreP1;
    gameState.scorePlayer2 = lastState.scoreP2;
    gameState.setsPlayer1 = lastState.setsP1;
    gameState.setsPlayer2 = lastState.setsP2;
    gameState.playerName1 = lastState.p1Name;
    gameState.playerName2 = lastState.p2Name;
    gameState.statistics = JSON.parse(JSON.stringify(lastState.statsSnapshot));
  
    if (lastState.actionType === 'point' && lastState.markerElement) {
      // Check if markerElement exists and has a parentNode before attempting removal
      if (lastState.markerElement && lastState.markerElement.parentNode === markersOverlay) {
        markersOverlay.removeChild(lastState.markerElement);
      } else {
        console.warn("Marqueur à supprimer non trouvé, déjà supprimé, ou null pour l'action annulée.");
      }
    } else if (lastState.actionType === 'next_set') {
      console.log("Annulation de l'action 'Set Suivant'");
    }
  
    updateScoreDisplay();
    updatePlayerNameDisplays();
    updateCharts();
    updateChartTitles();
    updateUndoButtonState();
    console.log("Dernière action annulée.");
  }
  function resetGame() { if (confirm("Êtes-vous sûr de vouloir réinitialiser le match et les statistiques ?")) { gameState.scorePlayer1 = 0; gameState.scorePlayer2 = 0; gameState.setsPlayer1 = 0; gameState.setsPlayer2 = 0; gameState.playerName1 = "Joueur 1"; gameState.playerName2 = "Joueur 2"; initializeStats(); updateScoreDisplay(); updatePlayerNameDisplays(); initializeCharts(); while (markersOverlay.firstChild) { markersOverlay.removeChild(markersOverlay.firstChild); } clearTimeout(pressTimer); pressTimer = null; startCoords = null; gameState.actionHistory = []; updateUndoButtonState(); resetTimer(); timerLimitInput.value = ''; timerState.limitSeconds = 0; updateChartTitles(); console.log("Jeu réinitialisé."); } }
  function updatePlayerNameDisplays() { playerName1Display.textContent = gameState.playerName1; playerName2Display.textContent = gameState.playerName2; }
  function editName(playerIndex) { const nameDisplay = (playerIndex === 1) ? playerName1Display : playerName2Display; const nameInput = (playerIndex === 1) ? playerName1Input : playerName2Input; const currentName = (playerIndex === 1) ? gameState.playerName1 : gameState.playerName2; nameInput.value = currentName; nameDisplay.style.display = 'none'; nameInput.style.display = 'inline-block'; nameInput.focus(); nameInput.select(); const saveHandler = () => { saveName(playerIndex, nameInput, nameDisplay); nameInput.removeEventListener('blur', saveHandler); nameInput.removeEventListener('keydown', keydownHandler); }; const keydownHandler = (event) => { if (event.key === 'Enter') { event.preventDefault(); saveHandler(); } else if (event.key === 'Escape') { nameInput.style.display = 'none'; nameDisplay.style.display = 'inline-block'; nameInput.removeEventListener('blur', saveHandler); nameInput.removeEventListener('keydown', keydownHandler); } }; nameInput.addEventListener('blur', saveHandler); nameInput.addEventListener('keydown', keydownHandler); }
  function saveName(playerIndex, inputElement, displayElement) { let newName = inputElement.value.trim(); if (!newName) { newName = (playerIndex === 1) ? "Joueur 1" : "Joueur 2"; } newName = newName.substring(0, 15); if (playerIndex === 1) { gameState.playerName1 = newName; } else { gameState.playerName2 = newName; } displayElement.textContent = newName; inputElement.style.display = 'none'; displayElement.style.display = 'inline-block'; updateChartTitles(); }
  function formatTime(totalSeconds) { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
  function updateTimerDisplay() { if (!timerDisplay) return; timerDisplay.textContent = formatTime(timerState.seconds); timerDisplay.classList.toggle('timer-over-limit', timerState.limitSeconds > 0 && timerState.seconds > timerState.limitSeconds); }
  function startTimer() { if (timerState.running || !timerStartPauseButton) return; timerState.running = true; timerStartPauseButton.textContent = '⏸️ Pause'; timerState.interval = setInterval(() => { timerState.seconds++; updateTimerDisplay(); }, 1000); }
  function pauseTimer() { if (!timerState.running || !timerStartPauseButton) return; timerState.running = false; timerStartPauseButton.textContent = '▶️ Start'; clearInterval(timerState.interval); timerState.interval = null; }
  function resetTimer() { pauseTimer(); timerState.seconds = 0; updateTimerDisplay(); }
  function handleStartPauseClick() { if (timerState.running) { pauseTimer(); } else { startTimer(); } }
  function handleLimitChange() { if (!timerLimitInput) return; const limitMinutes = parseInt(timerLimitInput.value, 10); if (isNaN(limitMinutes) || limitMinutes < 0) { timerState.limitSeconds = 0; timerLimitInput.value = ''; timerLimitInput.placeholder = "Aucune"; } else { timerState.limitSeconds = limitMinutes * 60; timerLimitInput.placeholder = "Limite: " + limitMinutes + " min"; } updateTimerDisplay(); }
  function handleNextSet() { saveStateBeforeAction(null, 'next_set'); if (gameState.scorePlayer1 > gameState.scorePlayer2) { gameState.setsPlayer1++; console.log(`Set gagné par ${gameState.playerName1}. Score sets: ${gameState.setsPlayer1}-${gameState.setsPlayer2}`); } else if (gameState.scorePlayer2 > gameState.scorePlayer1) { gameState.setsPlayer2++; console.log(`Set gagné par ${gameState.playerName2}. Score sets: ${gameState.setsPlayer1}-${gameState.setsPlayer2}`); } else { alert("Égalité! Impossible de déterminer le vainqueur du set."); gameState.actionHistory.pop(); updateUndoButtonState(); return; } gameState.scorePlayer1 = 0; gameState.scorePlayer2 = 0; updateScoreDisplay(); }
  function getMasteryLevelText(percentage) { if (percentage > 60) return "Très Satisfaisante"; if (percentage > 40) return "Satisfaisante"; if (percentage > 20) return "Fragile"; return "Insuffisante"; }
  function getMasteryLevelColor(levelText) { switch (levelText) { case "Très Satisfaisante": return [0, 0, 255]; case "Satisfaisante": return [0, 255, 0]; case "Fragile": return [255, 255, 0]; case "Insuffisante": return [255, 0, 0]; default: return [0, 0, 0]; } }
  function updateChartTitles() { if (chartTitlePlayer1) { chartTitlePlayer1.textContent = `[J1] ${gameState.playerName1} - Analyse`; } if (chartTitlePlayer2) { chartTitlePlayer2.textContent = `[J2] ${gameState.playerName2} - Analyse`; } }
  
  // Helper function for PDF generation - Mastery Level Info
  function getPdfMasteryInfo() {
    const dataP1Stats = [gameState.statistics.player2.hitsReceived.comfort + gameState.statistics.player1.impactsMade.comfort, gameState.statistics.player2.hitsReceived.validOther + gameState.statistics.player1.impactsMade.validOther, gameState.statistics.player2.hitsReceived.invalid + gameState.statistics.player1.impactsMade.invalidFault];
    const sumP1Stats = dataP1Stats.reduce((a, b) => a + b, 0);
    const percentExcentreesP1PDF = sumP1Stats > 0 ? (dataP1Stats[1] / sumP1Stats) * 100 : 0;
    const masteryP1Text = getMasteryLevelText(percentExcentreesP1PDF);
    const masteryP1Color = getMasteryLevelColor(masteryP1Text);

    const dataP2Stats = [gameState.statistics.player1.hitsReceived.comfort + gameState.statistics.player2.impactsMade.comfort, gameState.statistics.player1.hitsReceived.validOther + gameState.statistics.player2.impactsMade.validOther, gameState.statistics.player1.hitsReceived.invalid + gameState.statistics.player2.impactsMade.invalidFault];
    const sumP2Stats = dataP2Stats.reduce((a, b) => a + b, 0);
    const percentExcentreesP2PDF = sumP2Stats > 0 ? (dataP2Stats[1] / sumP2Stats) * 100 : 0;
    const masteryP2Text = getMasteryLevelText(percentExcentreesP2PDF);
    const masteryP2Color = getMasteryLevelColor(masteryP2Text);

    return {
        p1: { name: gameState.playerName1, text: masteryP1Text, color: masteryP1Color },
        p2: { name: gameState.playerName2, text: masteryP2Text, color: masteryP2Color }
    };
  }

  async function exportToPdf() {
      if (!exportPdfButton) return;
      exportPdfButton.disabled = true;
      exportPdfButton.innerHTML = `<span style="margin-right: 8px; font-size: 1.2em;">⏳</span> Génération...`;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const margin = 15; const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const contentWidth = pageWidth - 2 * margin; let yPos = margin;

      try {
          // Canvas options for html2canvas
          const canvasOptions = { scale: 2, useCORS: true, backgroundColor: '#ffffff' };
          
          // Generate canvas images
          const [chart1CanvasImage, chart2CanvasImage, courtCanvasImage] = await Promise.all([ 
              html2canvas(chartWrapperP1, canvasOptions), 
              html2canvas(chartWrapperP2, canvasOptions), 
              html2canvas(courtArea, canvasOptions) 
          ]);
          const chart1ImgData = chart1CanvasImage.toDataURL('image/png'); 
          const chart2ImgData = chart2CanvasImage.toDataURL('image/png'); 
          const courtImgData = courtCanvasImage.toDataURL('image/png');

          // PDF Header
          pdf.setFontSize(18); pdf.setFont("helvetica", "bold"); pdf.text("Rapport BadTracker", pageWidth / 2, yPos, { align: 'center' }); yPos += 8;
          pdf.setFontSize(10); pdf.setFont("helvetica", "normal"); pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 10;
          pdf.setFontSize(12); pdf.setFont("helvetica", "bolditalic"); pdf.text(`${gameState.playerName1} vs ${gameState.playerName2}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 12;

          // Mastery Levels
          pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Niveaux de Maîtrise", margin, yPos); yPos += 6;
          pdf.setFontSize(11); pdf.setFont("helvetica", "normal"); pdf.setTextColor(0, 0, 0);
          
          const masteryInfo = getPdfMasteryInfo(); // Use helper function
          pdf.text(`${masteryInfo.p1.name}:`, margin + 5, yPos); 
          pdf.setFont("helvetica", "bold"); pdf.setTextColor(...masteryInfo.p1.color); pdf.text(masteryInfo.p1.text, margin + 35, yPos); 
          pdf.setTextColor(0, 0, 0); yPos += 6;
          pdf.setFont("helvetica", "normal"); pdf.text(`${masteryInfo.p2.name}:`, margin + 5, yPos); 
          pdf.setFont("helvetica", "bold"); pdf.setTextColor(...masteryInfo.p2.color); pdf.text(masteryInfo.p2.text, margin + 35, yPos); 
          pdf.setTextColor(0, 0, 0); yPos += 10;

          // Scores Table
          pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Scores", margin, yPos); yPos += 6;
          pdf.autoTable({ 
              startY: yPos, 
              head: [['Joueur', 'Sets Gagnés', 'Score Actuel']], 
              body: [ 
                  [gameState.playerName1, gameState.setsPlayer1, gameState.scorePlayer1], 
                  [gameState.playerName2, gameState.setsPlayer2, gameState.scorePlayer2], 
              ], 
              theme: 'grid', 
              headStyles: { fillColor: [64, 140, 218] }, 
              margin: { left: margin, right: margin } 
          });
          yPos = pdf.lastAutoTable.finalY + 10;

          // Zone Analysis Charts
           const chartHeight = 60; const chartWidth = (contentWidth / 2) - 5;
           if (yPos + chartHeight > pageHeight - margin) { pdf.addPage(); yPos = margin; }
           pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Analyse des Zones", margin, yPos); yPos += 6;
           pdf.addImage(chart1ImgData, 'PNG', margin, yPos, chartWidth, chartHeight);
           pdf.addImage(chart2ImgData, 'PNG', margin + chartWidth + 10, yPos, chartWidth, chartHeight);
           yPos += chartHeight + 10;

           // Court Visualization
           const courtRatio = courtCanvasImage.height / courtCanvasImage.width; 
           const pdfCourtWidth = contentWidth * 0.8; // Adjusted for better fit
           const pdfCourtHeight = pdfCourtWidth * courtRatio; 
           const courtX = margin + (contentWidth - pdfCourtWidth) / 2;
           if (yPos + pdfCourtHeight > pageHeight - margin) { pdf.addPage(); yPos = margin; }
           pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Visualisation Terrain", margin, yPos); yPos += 6;
           pdf.addImage(courtImgData, 'PNG', courtX, yPos, pdfCourtWidth, pdfCourtHeight);
           yPos += pdfCourtHeight + 10;

           // Detailed Zone Stats Table
           if (yPos > pageHeight - margin - 20) { pdf.addPage(); yPos = margin; } // Check for page break before this table
           pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Statistiques Détaillées par Zone", margin, yPos); yPos += 6;
           const statsBody = [];
           for (const zone in gameState.statistics.rawZones) { 
               if (gameState.statistics.rawZones.hasOwnProperty(zone)) { 
                   const data = gameState.statistics.rawZones[zone]; 
                   statsBody.push([zone, data.hits || 0, data.impactsIn || 0, data.impactsFault || 0]); 
                } 
            }
           if (statsBody.length > 0) {
               pdf.autoTable({ 
                   startY: yPos, 
                   head: [['Zone', 'Volants Reçus', 'Points Marqués', 'Fautes Directes']], 
                   body: statsBody, 
                   theme: 'striped', 
                   headStyles: { fillColor: [51, 51, 51] }, // Darker header for this table
                   margin: { left: margin, right: margin } 
                });
               yPos = pdf.lastAutoTable.finalY + 10;
           } else { 
               pdf.setFontSize(10); pdf.setFont("helvetica", "italic"); 
               pdf.text("Aucune statistique de zone enregistrée.", margin, yPos); 
               yPos += 10; 
            }

          // Page Numbering Footer for all pages
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) { 
              pdf.setPage(i); 
              pdf.setFontSize(8); pdf.setFont("helvetica", "italic"); 
              pdf.text(`Page ${i} sur ${totalPages} - Rapport BadTracker`, pageWidth / 2, pageHeight - 8, { align: 'center' }); 
            }

          pdf.save(`BadTracker_Stats_${gameState.playerName1}_vs_${gameState.playerName2}.pdf`);

      } catch (error) { 
          console.error("Erreur détaillée lors de la génération du PDF:", error); // More detailed error
          alert("Une erreur est survenue lors de la génération du PDF. Vérifiez la console pour plus de détails."); 
        }
      finally { 
          exportPdfButton.disabled = false; 
          exportPdfButton.innerHTML = `<span style="margin-right: 8px; font-size: 1.2em;">📄</span> Exporter les stats`; 
        }
  }

  // PWA Specific Code
  // Détection de l'état de connexion
  function updateOnlineStatus() {
    const offlineIndicator = document.querySelector('.offline-indicator');
    if (offlineIndicator) {
      if (navigator.onLine) {
        offlineIndicator.style.display = 'none';
      } else {
        offlineIndicator.style.display = 'block';
        offlineIndicator.textContent = 'Mode hors ligne activé';
      }
    }
  }

  // Gestion de l'installation de la PWA
  let deferredPrompt;
  const installPrompt = document.getElementById('installPrompt');
  const installButton = document.getElementById('installButton');

  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher Chrome d'afficher automatiquement l'invite d'installation
    e.preventDefault();
    // Stocker l'événement pour pouvoir le déclencher plus tard
    deferredPrompt = e;
    // Afficher notre propre invite d'installation
    if (installPrompt) installPrompt.style.display = 'block';
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      // Affichage de l'invite d'installation
      deferredPrompt.prompt();
      
      // Attendre que l'utilisateur réponde à l'invite
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      
      // Nous n'avons plus besoin de l'événement différé
      deferredPrompt = null;
      
      // Cacher notre invite d'installation quel que soit le résultat
      installPrompt.style.display = 'none';
    });
  }

  // Masquer l'invite d'installation si l'application est déjà installée
  window.addEventListener('appinstalled', () => {
    console.log('App was installed');
    if (installPrompt) installPrompt.style.display = 'none';
    deferredPrompt = null;
  });

  // Vérifier si l'application est déjà installée au chargement
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('App is already installed');
    if (installPrompt) installPrompt.style.display = 'none';
  }

  // Écouter les changements d'état de connexion
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // Vérifier l'état initial

  // Association des écouteurs
  courtArea.addEventListener('mousedown', handlePressStart);
  courtArea.addEventListener('mouseup', handlePressEnd);
  courtArea.addEventListener('mouseleave', handleLeaveOrCancel);
  courtArea.addEventListener('touchstart', handlePressStart, { passive: false });
  courtArea.addEventListener('touchend', handlePressEnd, { passive: false });
  courtArea.addEventListener('touchcancel', handleLeaveOrCancel);
  resetButton.addEventListener('click', resetGame);
  undoButton.addEventListener('click', undoLastAction);
  window.addEventListener('resize', () => { if (chartInstances.player1 && chartInstances.player2) { const dataP1 = chartInstances.player1.data.datasets[0].data; const dataP2 = chartInstances.player2.data.datasets[0].data; const sumP1 = dataP1.reduce((a, b) => a + b, 0); const percentExcentreesP1 = sumP1 > 0 ? (dataP1[1] / sumP1) * 100 : 0; const sumP2 = dataP2.reduce((a, b) => a + b, 0); const percentExcentreesP2 = sumP2 > 0 ? (dataP2[1] / sumP2) * 100 : 0; updateMasteryGauges(percentExcentreesP1, percentExcentreesP2); } else { updateMasteryGauges(0, 0); } });
  playerName1Display.addEventListener('click', () => editName(1));
  playerName2Display.addEventListener('click', () => editName(2));
  if (timerStartPauseButton) { timerStartPauseButton.addEventListener('click', handleStartPauseClick); }
  if (timerResetButton) { timerResetButton.addEventListener('click', resetTimer); }
  if (timerLimitInput) { timerLimitInput.addEventListener('input', handleLimitChange); }
  if (nextSetButton) { nextSetButton.addEventListener('click', handleNextSet); }
  if (exportPdfButton) { exportPdfButton.addEventListener('click', exportToPdf); }

  // Initialisation
  initializeStats();      // Operates on gameState.statistics
  updateScoreDisplay();   // Reads from gameState
  updatePlayerNameDisplays(); // Reads from gameState
  initializeCharts();     // Initializes chartInstances
  updateUndoButtonState(); // Reads from gameState.actionHistory
  updateTimerDisplay();   // Reads from timerState
  handleLimitChange();    // Modifies timerState
  updateChartTitles();    // Reads from gameState
});
