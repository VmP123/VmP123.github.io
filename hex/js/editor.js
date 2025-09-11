import { HexGrid } from './grid.js';
import { HexGridView } from './grid-view.js';
import { GameState } from './state.js';
import { TerrainType, UnitType, PlayerType } from './constants.js';
import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { Unit } from './unit.js';
import { UnitView } from './unit-view.js';
import { ViewController } from './view-controller.js';

document.addEventListener('DOMContentLoaded', async () => {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  const svgService = new SvgService();
  await svgService.load();
  
  const hexRadius = 50;
  const lineWidth = 2;
  const gameState = new GameState();
  let hexGrid;
  let hexGridView;
  const mainSvg = document.getElementById('main');
  
  let mapWidth;
  let mapHeight;
  
  let viewController;

  async function drawMap(scenario) {
    mainSvg.innerHTML = '';
    hexGrid = new HexGrid(scenario.height, scenario.width, scenario, gameState, true);
    hexGridView = new HexGridView(hexGrid, hexRadius, lineWidth, gameState, true, svgService, null);
    await hexGridView.drawHexGrid();
    mainSvg.appendChild(hexGridView.svg);
    
    mapWidth = parseFloat(hexGridView.svg.getAttribute('width'));
    mapHeight = parseFloat(hexGridView.svg.getAttribute('height'));

    if (!viewController) {
      viewController = new ViewController(mainSvg, mapWidth, mapHeight);
      hexGridView.viewController = viewController;
    }
    else {
      viewController.updateMapDimensions(mapWidth, mapHeight);
    }

    hexGridView.hexViews.forEach(hexView => {
      hexView.svg.addEventListener('click', (e) => {
        if (viewController.panned) {
            return;
        }
        onHexClick(hexView, e)
      });
    });
    
    viewController.setViewBox(-100, -100, baseWidth, baseHeight);
  }
  
  const editorMapWrapper = document.getElementById('editor-map-wrapper');
  const baseWidth = 1024;
  const baseHeight = 880;
  const outerMargin = 25;
  
  function resizeEditor() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const sidebarWidth = document.getElementById('editor-controls').offsetWidth;
    const availableWidth = viewportWidth - sidebarWidth - outerMargin * 2;
    const availableHeight = viewportHeight - outerMargin * 2;
    
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;
    
    const scale = Math.min(scaleX, scaleY);
    
    editorMapWrapper.style.transform = `scale(${scale})`;
  }
  
  window.addEventListener('resize', resizeEditor);
  resizeEditor();
  
  const initialScenario = new ScenarioMap();
  initialScenario.createEmptyMap(10, 10);
  await drawMap(initialScenario);
  
  let selectedTerrain = null;
  let selectedUnit = null;
  let riverMode = false;
  let flagMode = false;
  
  const terrainPalette = document.getElementById('terrain-palette');
  for (const terrain in TerrainType) {
    if (terrain === TerrainType.FLAG.toUpperCase())
      continue;

    const button = document.createElement('button');
    button.textContent = capitalize(terrain);
    button.addEventListener('click', (e) => {
      selectedTerrain = TerrainType[terrain];
      selectedUnit = null;
      riverMode = false;
      flagMode = false;
      updateSelectedPalette(e.target);
    });
    terrainPalette.appendChild(button);
  }
  
  const unitPalette = document.getElementById('unit-palette');
  for (const unit in UnitType) {
    const button = document.createElement('button');
    button.textContent = capitalize(unit);
    button.addEventListener('click', (e) => {
      selectedUnit = UnitType[unit];
      selectedTerrain = null;
      riverMode = false;
      flagMode = false;
      updateSelectedPalette(e.target);
    });
    unitPalette.appendChild(button);
  }
  const removeUnitButton = document.createElement('button');
  removeUnitButton.textContent = capitalize("remove unit");
  removeUnitButton.addEventListener('click', (e) => {
    selectedUnit = 'remove';
    selectedTerrain = null;
    riverMode = false;
    flagMode = false;
    updateSelectedPalette(e.target);
  });
  unitPalette.appendChild(removeUnitButton);
  
  const riverButton = document.createElement('button');
  riverButton.textContent = capitalize("river");
  riverButton.addEventListener('click', (e) => {
    riverMode = !riverMode;
    selectedTerrain = null;
    selectedUnit = null;
    flagMode = false;
    updateSelectedPalette(e.target);
  });
  terrainPalette.appendChild(riverButton);

  const flagButton = document.createElement('button');
  flagButton.textContent = "Flag";
  flagButton.addEventListener('click', (e) => {
    selectedTerrain = null;
    selectedUnit = null;
    riverMode = false;
    flagMode = true;
    updateSelectedPalette(e.target);
  });
  terrainPalette.appendChild(flagButton);
  
  
  function updateSelectedPalette(selectedButton) {
    document.querySelectorAll('#terrain-palette button, #unit-palette button').forEach(button => {
      button.classList.remove('selected');
    });
    selectedButton.classList.add('selected');
  }
  
  function onHexClick(hexView, event) {
    const hex = hexView.hex;
    const mainSvg = document.getElementById('main');
    const screenPoint = new DOMPoint(event.clientX, event.clientY);
    const inverseMatrix = mainSvg.getScreenCTM().inverse();
    const svgPoint = screenPoint.matrixTransform(inverseMatrix);

    const svgX = svgPoint.x;
    const svgY = svgPoint.y;

    const hexX = parseFloat(hexView.svg.getAttribute('x'));
    const hexY = parseFloat(hexView.svg.getAttribute('y'));

    const clickXInHex = svgX - hexX;
    const clickYInHex = svgY - hexY;

    if (riverMode) {
      const edgeIndex = hexView.getClosestSide(clickXInHex, clickYInHex);
      hex.toggleRiver(edgeIndex);
      hexGridView.redrawAllRivers();
    }
    else if (selectedTerrain) {
      hex.setTerrain(selectedTerrain);
      hexView.setTerrain(selectedTerrain);
    }
    else if (flagMode) {
        const player = document.getElementById('player-select').value === '0' ? PlayerType.GREY : PlayerType.GREEN;
        if (hex.flag) {
            hex.setFlag(false, null);
        } else {
            hex.setFlag(true, player);
        }
        hexView.setFlag(hex.flag, hex.player);
    }
    else if (selectedUnit) {
      const existingUnit = hex.unit;
      if (existingUnit) {
          hexGrid.removeUnit(existingUnit);
          hexGridView.removeUnit(existingUnit);
      }

      if (selectedUnit !== 'remove') {
          const player = document.getElementById('player-select').value === '0' ? PlayerType.GREY : PlayerType.GREEN;
          const newUnit = new Unit(hex.x, hex.y, selectedUnit, player);
          hexGrid.addUnit(newUnit);
          hex.setUnit(newUnit);
          
          const baseRect = svgService.svgElements[newUnit.unitType + ".svg"].cloneNode(true);
          const newUnitView = new UnitView(newUnit, hexGridView, gameState);
          newUnitView.createUnit(baseRect);
          newUnitView.setBackgroundColor();
          newUnitView.refreshStatusText();
          hexGridView.addUnitView(newUnitView);
      }
    }
  }
  
  const exportButton = document.getElementById('export-map');
  exportButton.addEventListener('click', () => {
    const mapData = {
      width: hexGrid.cols,
      height: hexGrid.rows,
      hexList: hexGrid.hexes.map(hex => ({
        x: hex.x,
        y: hex.y,
        terrain: hex.terrainType,
        unit: hex.unit ? hex.unit.unitType : null,
        player: hex.unit ? hex.unit.player : (hex.player ? hex.player : null),
        riverEdges: hex.riverEdges,
        flag: hex.flag
      }))
    };
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  
  const importInput = document.getElementById('import-map');
  importInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const mapData = JSON.parse(e.target.result);
        const newScenario = new ScenarioMap();
        newScenario.width = mapData.width;
        newScenario.height = mapData.height;
        newScenario.mapHexes = mapData.hexList;
        document.getElementById('rows').value = mapData.height;
        document.getElementById('cols').value = mapData.width;
        await drawMap(newScenario);
      };
      reader.readAsText(file);
    }
  });
  
  const setSizeButton = document.getElementById('set-size');
  setSizeButton.addEventListener('click', async () => {
    const rows = parseInt(document.getElementById('rows').value, 10);
    const cols = parseInt(document.getElementById('cols').value, 10);
    if (rows > 0 && cols > 0) {
      const newScenario = new ScenarioMap();
      newScenario.createEmptyMap(rows, cols);
      await drawMap(newScenario);
    }
  });
  
  const zoomButton = document.getElementById('zoom');
  zoomButton.addEventListener('click', () => {
    viewController.zoom();
  });
});