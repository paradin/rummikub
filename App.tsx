
import React, { useState, useEffect, useCallback } from 'react';
import { Tile, TileSet, GameState } from './types';
import { createDeck, isValidSet, calculateSetPoints, sortHand, aiPlayTurn } from './utils/gameLogic';
import TileComponent from './components/TileComponent';

const INITIAL_HAND_SIZE = 14;

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
  const [gameId, setGameId] = useState(0);

  const [turnStartState, setTurnStartState] = useState<GameState | null>(null);
  const [selectedInHand, setSelectedInHand] = useState<Set<string>>(new Set());
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [turnPoints, setTurnPoints] = useState(0);
  const [turnTilesPlayed, setTurnTilesPlayed] = useState<Tile[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const isPlayerTurn = gameState.currentPlayerIndex === 0;

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
      setGameState(prev => ({ ...prev, message: "Can't draw after playing tiles!" }));
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
      message: "You drew a tile.",
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
       setGameState(prev => ({ ...prev, message: "Meld 30pts first!" }));
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
      message: "Added to board.",
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
      setGameState(prev => ({ ...prev, message: `Need 30pts! Current: ${turnPoints}` }));
      return;
    }

    if (turnTilesPlayed.length === 0) {
      setGameState(prev => ({ ...prev, message: "Draw if you don't play." }));
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

  useEffect(() => {
    if (gameState.currentPlayerIndex !== 0 && gameState.winner === null) {
      setIsProcessingAI(true);
      const currentId = gameId;
      
      const timer = setTimeout(() => {
        setGameState(prev => {
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
              aiMessage = `AI ${aiIdx} drew.`;
            } else {
              aiMessage = `AI ${aiIdx} passed.`;
            }
          } else {
            aiMessage = `AI ${aiIdx} moved.`;
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
            message: nextPlayer === 0 ? `Your turn! (${aiMessage})` : aiMessage,
            winner: finalHand.length === 0 ? aiIdx : null
          };
        });
        
        setIsProcessingAI(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayerIndex, gameState.winner, gameId]);

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900 select-none overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center p-3 md:p-4 bg-white shadow-sm border-b border-slate-200 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg font-bold text-lg">R</div>
          <h1 className="text-lg font-bold text-slate-800 hidden sm:block">Rummikub</h1>
        </div>
        
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowHelp(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-black text-slate-600">{gameState.pool.length}</span>
          </div>
          <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-full transition-colors active:rotate-180 duration-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Opponents Section - Horizontal on mobile, Sidebar on desktop */}
        <aside className="w-full md:w-48 lg:w-56 flex md:flex-col gap-2 p-2 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-200 overflow-x-auto md:overflow-y-auto scrollbar-hide">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex-shrink-0 w-32 md:w-auto p-2 md:p-3 rounded-xl border-2 transition-all duration-300 ${gameState.currentPlayerIndex === i ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-transparent bg-white shadow-sm opacity-80'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] font-black uppercase ${gameState.currentPlayerIndex === i ? 'text-indigo-700' : 'text-slate-500'}`}>AI {i}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${gameState.hasMeld[i] ? 'bg-green-500' : 'bg-slate-300'}`}></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-1.5">
                   {[...Array(Math.min(gameState.aiHands[i-1].length, 2))].map((_, j) => (
                      <div key={j} className="w-3 h-5 bg-slate-200 rounded border border-white"></div>
                   ))}
                   {gameState.aiHands[i-1].length > 2 && <div className="text-[8px] font-bold text-slate-400 pl-1">+{gameState.aiHands[i-1].length - 2}</div>}
                </div>
                <div className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-black text-slate-500">{gameState.aiHands[i-1].length}</div>
              </div>
            </div>
          ))}

          {/* Log/Message Box - Moved into the same flow */}
          <div className="hidden md:flex flex-col mt-auto p-3 bg-slate-800 text-white rounded-xl shadow-lg">
            <span className="text-[9px] font-black uppercase opacity-50 mb-1 tracking-widest">Game Log</span>
            <p className="text-[11px] font-bold leading-tight min-h-[2.5rem]">{gameState.message}</p>
            {!gameState.hasMeld[0] && (
               <div className="mt-2 w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                 <div className="bg-indigo-400 h-full transition-all duration-500" style={{ width: `${Math.min(100, (turnPoints / 30) * 100)}%` }}></div>
               </div>
            )}
          </div>
        </aside>

        {/* Main Board Area */}
        <main className="flex-1 flex flex-col bg-slate-200/30 p-2 md:p-6 overflow-y-auto">
          {/* Mobile Log display */}
          <div className="md:hidden flex items-center justify-between px-2 py-1 mb-2 bg-slate-800 text-white rounded-lg text-xs font-bold">
            <span className="truncate flex-1 pr-2">{gameState.message}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${gameState.hasMeld[0] ? 'bg-green-500' : 'bg-indigo-500'}`}>
               {gameState.hasMeld[0] ? 'MELDED' : `${turnPoints}/30`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 items-start content-start">
            {gameState.board.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center py-16 md:py-32 text-slate-300">
                <div className="text-4xl md:text-5xl opacity-20 mb-2">🧩</div>
                <p className="font-black text-[10px] md:text-xs uppercase tracking-widest opacity-40">Empty Board</p>
              </div>
            ) : (
              gameState.board.map((set, idx) => (
                <div key={idx} onClick={() => isPlayerTurn && handleAddToSet(idx)}
                  className={`flex bg-white/90 p-1 md:p-2 rounded-lg md:rounded-xl border-2 shadow-sm transition-all duration-200 ${isPlayerTurn && selectedInHand.size > 0 ? 'hover:border-indigo-400 hover:bg-white cursor-pointer active:scale-95' : 'border-white'}`}>
                  {set.map(tile => <TileComponent key={tile.id} tile={tile} size="xs" disabled />)}
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Player Hand & Controls Section */}
      <section className="bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-10 px-3 py-3 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-3">
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={handlePlayNewSet} disabled={!isPlayerTurn || selectedInHand.size < 3 || gameState.winner !== null}
              className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-[11px] md:text-xs uppercase tracking-tight">
              Play ({selectedInHand.size})
            </button>
            <button onClick={handleDraw} disabled={!isPlayerTurn || gameState.winner !== null || isProcessingAI || turnTilesPlayed.length > 0}
              className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 text-slate-900 font-black rounded-xl transition-all shadow-md active:scale-95 text-[11px] md:text-xs uppercase tracking-tight">
              Draw
            </button>
            <button onClick={handleEndTurn} disabled={!isPlayerTurn || gameState.winner !== null || isProcessingAI || turnTilesPlayed.length === 0}
              className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-[11px] md:text-xs uppercase tracking-tight">
              Done
            </button>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto justify-center md:justify-end">
             <button onClick={handleUndo} disabled={!isPlayerTurn || turnTilesPlayed.length === 0}
              className="px-3 py-1.5 text-rose-600 font-bold hover:bg-rose-50 disabled:opacity-0 rounded-lg transition-all text-[11px] uppercase">
              Undo
            </button>
            <div className="flex gap-1 p-1 bg-slate-50 rounded-xl">
              <button onClick={() => handleSort('number')} className="px-2.5 py-1 text-[10px] font-black bg-white shadow-sm rounded-lg active:bg-indigo-50">123</button>
              <button onClick={() => handleSort('color')} className="px-2.5 py-1 text-[10px] font-black bg-white shadow-sm rounded-lg active:bg-indigo-50">RGB</button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center min-h-[80px] md:min-h-[110px] p-2 md:p-4 bg-slate-50 rounded-2xl border border-slate-100 overflow-y-auto max-h-[180px] md:max-h-[220px]">
          {gameState.playerHand.map(tile => (
            <TileComponent key={tile.id} tile={tile} size="sm" selected={selectedInHand.has(tile.id)} onClick={() => toggleSelectInHand(tile.id)} disabled={!isPlayerTurn || gameState.winner !== null} />
          ))}
        </div>
      </section>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-sm w-full shadow-2xl overflow-y-auto max-h-[85vh]">
            <h2 className="text-2xl font-black mb-4 text-indigo-700">How to Play</h2>
            <ul className="space-y-3 text-sm text-slate-600 font-medium">
              <li>• <strong className="text-slate-900">Groups:</strong> 3-4 tiles, same number, different colors.</li>
              <li>• <strong className="text-slate-900">Runs:</strong> 3+ consecutive numbers, same color.</li>
              <li>• <strong className="text-slate-900">Initial Meld:</strong> Your first play must total 30+ points.</li>
              <li>• <strong className="text-slate-900">Modifying:</strong> After melding, add tiles to existing sets on the board.</li>
              <li>• <strong className="text-slate-900">Drawing:</strong> Must draw if you can't or don't want to play.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-transform">GOT IT</button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState.winner !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] p-10 md:p-12 max-w-xs w-full text-center shadow-2xl scale-in-center">
            <div className="text-6xl md:text-7xl mb-6">{gameState.winner === 0 ? "👑" : "🤖"}</div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">{gameState.winner === 0 ? "VICTORY!" : "DEFEAT"}</h2>
            <p className="text-sm md:text-base text-slate-500 mb-8 font-bold">{gameState.winner === 0 ? "You cleared your hand!" : `AI ${gameState.winner} won.`}</p>
            <button onClick={handleReset} className="w-full py-3 md:py-4 bg-indigo-600 text-white text-lg font-black rounded-3xl shadow-lg active:scale-95">REPLAY</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
