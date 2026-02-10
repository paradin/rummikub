
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tile, TileSet, GameState, TileColor } from './types';
import { createDeck, isValidSet, calculateSetPoints, sortHand, aiPlayTurn } from './utils/gameLogic';
import TileComponent from './components/TileComponent';

const INITIAL_HAND_SIZE = 14;

// Helper to generate a fresh game state
const getInitialGameState = (): GameState => {
  const deck = createDeck();
  return {
    board: [],
    playerHand: deck.splice(0, INITIAL_HAND_SIZE),
    aiHands: [
      deck.splice(0, INITIAL_HAND_SIZE),
      deck.splice(0, INITIAL_HAND_SIZE),
      deck.splice(0, INITIAL_HAND_SIZE),
    ],
    pool: deck,
    currentPlayerIndex: 0,
    hasMeld: [false, false, false, false],
    winner: null,
    message: "Your turn! Form sets of 3+ tiles. First play needs 30 points.",
  };
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(getInitialGameState);
  const [gameId, setGameId] = useState(0); // Used to invalidate stale AI logic on reset

  const [turnStartState, setTurnStartState] = useState<GameState | null>(null);
  const [selectedInHand, setSelectedInHand] = useState<Set<string>>(new Set());
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [turnPoints, setTurnPoints] = useState(0);
  const [turnTilesPlayed, setTurnTilesPlayed] = useState<Tile[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const isPlayerTurn = gameState.currentPlayerIndex === 0;

  // Initialize turn snapshot for Undo
  useEffect(() => {
    if (isPlayerTurn && !turnStartState && gameState.winner === null) {
      setTurnStartState(JSON.parse(JSON.stringify(gameState)));
      setTurnPoints(0);
      setTurnTilesPlayed([]);
    }
  }, [isPlayerTurn, gameState.winner, turnStartState, gameState]);

  const toggleSelectInHand = (id: string) => {
    if (!isPlayerTurn || gameState.winner !== null) return;
    const newSelected = new Set(selectedInHand);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedInHand(newSelected);
  };

  const handleReset = () => {
    // Increment gameId to invalidate any pending AI turns from the previous game
    setGameId(prev => prev + 1);
    setIsProcessingAI(false);
    setGameState(getInitialGameState());
    setTurnStartState(null);
    setSelectedInHand(new Set());
    setTurnPoints(0);
    setTurnTilesPlayed([]);
  };

  const handleDraw = useCallback(() => {
    if (!isPlayerTurn || gameState.winner !== null || isProcessingAI) return;
    if (turnTilesPlayed.length > 0) {
      setGameState(prev => ({ ...prev, message: "Can't draw after playing tiles! Reset or End Turn." }));
      return;
    }
    if (gameState.pool.length === 0) {
      setGameState(prev => ({ ...prev, message: "Pool empty! Must end turn." }));
      return;
    }

    const newPool = [...gameState.pool];
    const drawnTile = newPool.pop()!;
    setGameState(prev => ({
      ...prev,
      playerHand: [...prev.playerHand, drawnTile],
      pool: newPool,
      currentPlayerIndex: 1,
      message: "You drew a tile. Opponents are moving...",
    }));
    setSelectedInHand(new Set());
    setTurnStartState(null);
  }, [isPlayerTurn, gameState, isProcessingAI, turnTilesPlayed]);

  const handlePlayNewSet = () => {
    if (selectedInHand.size < 3) {
      setGameState(prev => ({ ...prev, message: "At least 3 tiles required!" }));
      return;
    }
    const selectedTiles = gameState.playerHand.filter(t => selectedInHand.has(t.id));
    if (!isValidSet(selectedTiles)) {
      setGameState(prev => ({ ...prev, message: "Invalid group or run!" }));
      return;
    }

    const points = calculateSetPoints(selectedTiles);
    const newTurnPoints = turnPoints + points;
    const newHand = gameState.playerHand.filter(t => !selectedInHand.has(t.id));
    const newBoard = [...gameState.board, selectedTiles];

    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      board: newBoard,
      message: gameState.hasMeld[0] ? "Played a set!" : `Meld progress: ${newTurnPoints}/30`,
    }));
    
    setTurnPoints(newTurnPoints);
    setTurnTilesPlayed([...turnTilesPlayed, ...selectedTiles]);
    setSelectedInHand(new Set());

    if (newHand.length === 0 && (gameState.hasMeld[0] || newTurnPoints >= 30)) {
      setGameState(prev => ({ ...prev, winner: 0, message: "Victory!" }));
    }
  };

  const handleAddToSet = (setIdx: number) => {
    if (selectedInHand.size === 0) return;
    if (!gameState.hasMeld[0] && turnPoints < 30) {
       setGameState(prev => ({ ...prev, message: "Reach 30 points before modifying the board!" }));
       return;
    }

    const selectedTiles = gameState.playerHand.filter(t => selectedInHand.has(t.id));
    const targetSet = gameState.board[setIdx];
    const newTestSet = [...targetSet, ...selectedTiles];

    if (!isValidSet(newTestSet)) {
      setGameState(prev => ({ ...prev, message: "Invalid addition!" }));
      return;
    }

    const newHand = gameState.playerHand.filter(t => !selectedInHand.has(t.id));
    const newBoard = [...gameState.board];
    newBoard[setIdx] = newTestSet;

    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      board: newBoard,
      message: "Appended to board set.",
    }));
    setTurnTilesPlayed([...turnTilesPlayed, ...selectedTiles]);
    setSelectedInHand(new Set());
  };

  const handleUndo = () => {
    if (turnStartState) {
      setGameState(JSON.parse(JSON.stringify(turnStartState)));
      setTurnPoints(0);
      setTurnTilesPlayed([]);
      setSelectedInHand(new Set());
    }
  };

  const handleEndTurn = () => {
    if (!isPlayerTurn || gameState.winner !== null) return;
    const hasMeldNow = gameState.hasMeld[0] || turnPoints >= 30;
    
    if (turnTilesPlayed.length > 0 && !hasMeldNow) {
      setGameState(prev => ({ ...prev, message: `Need 30 points for initial meld! Current: ${turnPoints}` }));
      return;
    }

    if (turnTilesPlayed.length === 0) {
      setGameState(prev => ({ ...prev, message: "You must draw if you don't play." }));
      return;
    }

    const newHasMeld = [...gameState.hasMeld];
    if (turnPoints >= 30) newHasMeld[0] = true;

    setGameState(prev => ({
      ...prev,
      currentPlayerIndex: 1,
      hasMeld: newHasMeld,
      message: "AI thinking...",
    }));
    setTurnStartState(null);
    setTurnPoints(0);
    setTurnTilesPlayed([]);
  };

  const handleSort = (type: 'number' | 'color') => {
    setGameState(prev => ({
      ...prev,
      playerHand: sortHand(prev.playerHand, type)
    }));
  };

  // AI Turn Logic
  useEffect(() => {
    if (gameState.currentPlayerIndex !== 0 && gameState.winner === null) {
      setIsProcessingAI(true);
      const currentId = gameId; // Closure capture for this game session
      
      const timer = setTimeout(() => {
        setGameState(prev => {
          // If the game was reset while this timer was pending, abort
          if (currentId !== gameId) return prev;
          
          const aiIdx = prev.currentPlayerIndex;
          if (aiIdx === 0) return prev;

          const { newHand, newBoard, madeMove } = aiPlayTurn(
            prev.aiHands[aiIdx - 1], 
            prev.board, 
            prev.hasMeld[aiIdx]
          );

          let finalHand = newHand;
          let finalPool = [...prev.pool];
          let aiMessage = "";

          if (!madeMove) {
            if (finalPool.length > 0) {
              const drawnTile = finalPool.pop()!;
              finalHand = [...finalHand, drawnTile];
              aiMessage = `AI ${aiIdx} drew a tile.`;
            } else {
              aiMessage = `AI ${aiIdx} passed.`;
            }
          } else {
            aiMessage = `AI ${aiIdx} made a move.`;
          }

          const updatedAiHands = [...prev.aiHands];
          updatedAiHands[aiIdx - 1] = finalHand;
          
          const updatedHasMeld = [...prev.hasMeld];
          if (madeMove) updatedHasMeld[aiIdx] = true;

          const nextPlayer = (aiIdx + 1) % 4;
          
          return {
            ...prev,
            aiHands: updatedAiHands,
            board: newBoard,
            pool: finalPool,
            hasMeld: updatedHasMeld,
            currentPlayerIndex: nextPlayer,
            message: nextPlayer === 0 ? `Your turn! (${aiMessage})` : `${aiMessage} Thinking...`,
            winner: finalHand.length === 0 ? aiIdx : null
          };
        });
        
        setIsProcessingAI(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayerIndex, gameState.winner, gameId]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-slate-100 text-slate-900 select-none">
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-xl font-bold text-2xl shadow-lg shadow-indigo-200">R</div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Rummikub</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Master Strategy</p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowHelp(true)} className="text-slate-400 hover:text-indigo-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-black text-slate-600">{gameState.pool.length}</span>
          </div>
          <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-full transition-colors active:rotate-180 duration-500" title="Reset Game">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        <div className="lg:w-56 flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={`p-3 rounded-2xl border-2 transition-all duration-300 ${gameState.currentPlayerIndex === i ? 'border-indigo-500 bg-indigo-50 shadow-md translate-x-1' : 'border-transparent bg-white shadow-sm opacity-70'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-black ${gameState.currentPlayerIndex === i ? 'text-indigo-700' : 'text-slate-500'}`}>OPPONENT {i}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${gameState.hasMeld[i] ? 'bg-green-500' : 'bg-slate-300'}`}></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-1">
                   {[...Array(Math.min(gameState.aiHands[i-1].length, 3))].map((_, j) => (
                      <div key={j} className="w-4 h-6 bg-slate-200 rounded border border-white"></div>
                   ))}
                   {gameState.aiHands[i-1].length > 3 && <div className="text-[9px] font-bold text-slate-400 pl-1">+{gameState.aiHands[i-1].length - 3}</div>}
                </div>
                <div className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-black text-slate-500">{gameState.aiHands[i-1].length}</div>
              </div>
            </div>
          ))}

          <div className="mt-auto p-4 bg-slate-800 text-white rounded-2xl shadow-xl border-b-4 border-slate-950">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Log</span>
              <div className={`px-2 py-0.5 rounded text-[8px] font-bold ${gameState.hasMeld[0] ? 'bg-green-500 text-white' : 'bg-indigo-500 text-white animate-pulse'}`}>
                {gameState.hasMeld[0] ? 'MELDED' : 'INITIAL MELD'}
              </div>
            </div>
            <p className="text-xs font-bold leading-snug">{gameState.message}</p>
            {!gameState.hasMeld[0] && (
               <div className="mt-3 w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                 <div className="bg-indigo-400 h-full transition-all duration-500" style={{ width: `${Math.min(100, (turnPoints / 30) * 100)}%` }}></div>
               </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-200/40 rounded-3xl p-6 border border-slate-200 shadow-inner overflow-y-auto min-h-[300px]">
          <div className="flex flex-wrap gap-3 items-start content-start">
            {gameState.board.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center py-20 text-slate-300">
                <div className="text-5xl opacity-20 mb-2">🧩</div>
                <p className="font-black text-xs uppercase tracking-widest opacity-40">Empty Board</p>
              </div>
            ) : (
              gameState.board.map((set, idx) => (
                <div key={idx} onClick={() => isPlayerTurn && handleAddToSet(idx)}
                  className={`flex bg-white/80 p-2 rounded-xl border-2 shadow-sm transition-all duration-200 ${isPlayerTurn && selectedInHand.size > 0 ? 'hover:border-indigo-400 hover:bg-white cursor-pointer' : 'border-slate-100'}`}>
                  {set.map(tile => <TileComponent key={tile.id} tile={tile} size="sm" disabled />)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white p-5 rounded-3xl shadow-2xl border border-slate-100 z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={handlePlayNewSet} disabled={!isPlayerTurn || selectedInHand.size < 3 || gameState.winner !== null}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 text-xs">
              PLAY SET ({selectedInHand.size})
            </button>
            <button onClick={handleDraw} disabled={!isPlayerTurn || gameState.winner !== null || isProcessingAI || turnTilesPlayed.length > 0}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 text-slate-900 font-black rounded-xl transition-all shadow-lg active:scale-95 text-xs">
              DRAW
            </button>
            <div className="hidden md:block w-px bg-slate-200 mx-2"></div>
            <button onClick={handleUndo} disabled={!isPlayerTurn || turnTilesPlayed.length === 0}
              className="px-4 py-2 text-rose-600 font-bold hover:bg-rose-50 disabled:opacity-0 rounded-xl transition-all text-xs">
              UNDO
            </button>
            <button onClick={handleEndTurn} disabled={!isPlayerTurn || gameState.winner !== null || isProcessingAI || turnTilesPlayed.length === 0}
              className="px-6 py-2.5 bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-black rounded-xl transition-all shadow-xl active:scale-95 text-xs">
              END TURN
            </button>
          </div>
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
            <button onClick={() => handleSort('number')} className="px-3 py-1.5 text-[10px] font-black bg-white shadow-sm rounded-lg">123</button>
            <button onClick={() => handleSort('color')} className="px-3 py-1.5 text-[10px] font-black bg-white shadow-sm rounded-lg">RGB</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center min-h-[90px] p-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200/50">
          {gameState.playerHand.map(tile => (
            <TileComponent key={tile.id} tile={tile} selected={selectedInHand.has(tile.id)} onClick={() => toggleSelectInHand(tile.id)} disabled={!isPlayerTurn || gameState.winner !== null} />
          ))}
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl overflow-y-auto max-h-[80vh]">
            <h2 className="text-2xl font-black mb-4 text-indigo-700">How to Play</h2>
            <ul className="space-y-3 text-sm text-slate-600 font-medium">
              <li>• <strong className="text-slate-900">Groups:</strong> 3 or 4 tiles of the same number but different colors.</li>
              <li>• <strong className="text-slate-900">Runs:</strong> 3+ consecutive numbers of the same color.</li>
              <li>• <strong className="text-slate-900">Initial Meld:</strong> Your first play must total 30+ points.</li>
              <li>• <strong className="text-slate-900">Modifying:</strong> After melding, you can add tiles to existing sets on the board.</li>
              <li>• <strong className="text-slate-900">Drawing:</strong> If you don't play any tiles, you must draw one and end your turn.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl">GOT IT</button>
          </div>
        </div>
      )}

      {gameState.winner !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] p-12 max-w-xs w-full text-center shadow-2xl scale-in-center">
            <div className="text-7xl mb-6">{gameState.winner === 0 ? "👑" : "🤖"}</div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">{gameState.winner === 0 ? "VICTORY!" : "DEFEAT"}</h2>
            <p className="text-slate-500 mb-8 font-bold">{gameState.winner === 0 ? "You cleared your hand!" : `AI ${gameState.winner} won the game.`}</p>
            <button onClick={handleReset} className="w-full py-4 bg-indigo-600 text-white text-lg font-black rounded-3xl shadow-lg active:scale-95">REPLAY</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
