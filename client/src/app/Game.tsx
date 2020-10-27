import _ from 'lodash';
import React, { useContext, useLayoutEffect } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import styled from 'styled-components';
import AbstractGameManager, {
  GameManagerEvent,
} from '../api/AbstractGameManager';
import {
  boardFromGame,
  boardLocMap,
  boardMap,
  compareLoc,
  getCanMove,
  hasLoc,
  isGhost,
} from '../utils/ChessUtils';
import {
  BoardLocation,
  ChessCell,
  ChessGame,
  Color,
  Ghost,
  Hook,
  Piece,
  Selectable,
  StagedLoc,
} from '../_types/global/GlobalTypes';
import { ChessPiece, ObjectivePiece, PiecePos } from './BoardPieces';
import { GameManagerContext } from './LandingPage';

const borderColor = 'black';
const StyledGameBoard = styled.table`
  & tr:last-child td {
    border-bottom: 1px solid ${borderColor};
  }

  & td {
    width: 64pt;
    height: 64pt;
    padding: 0;
    margin: 0;
    position: relative;

    border-left: 1px solid ${borderColor};
    border-top: 1px solid ${borderColor};

    &:last-child {
      border-right: 1px solid ${borderColor};
    }
  }
`;

const StyledGameCell = styled.div<{ canMove: boolean }>`
  width: 100%;
  height: 100%;
  margin: 0;

  background: ${(props) => (props.canMove ? '#f2f2f2' : 'none')};
`;

function GameCell({
  cell,
  location,
  selectedHook,
  canMove,
  stagedHook,
  turnState,
}: {
  // data
  cell: ChessCell;
  location: BoardLocation;
  turnState: TurnState;

  // for displaying
  selectedHook: Hook<Selectable | null>;
  canMove: boolean;
  stagedHook: Hook<StagedLoc | null>;
}) {
  const gm = useContext<AbstractGameManager | null>(GameManagerContext);
  if (!gm) return <>error</>;

  const [selected, setSelected] = selectedHook;
  const [staged, setStaged] = stagedHook;

  const double = cell.piece && cell.ghost;
  const isEmpty = !cell.piece && !cell.ghost;
  const canReallyMove = canMove && isEmpty;

  const notMyTurn = turnState >= TurnState.Submitting;

  const pieceHandler = (obj: Piece | Ghost): React.MouseEventHandler => (
    e: React.MouseEvent
  ) => {
    if (notMyTurn) return;

    // if i don't own it, do nothing
    if (obj.owner !== gm.getAccount()) return;

    // clear staged when i click on currently selected
    if (selected?.id === obj.id) {
      setStaged(null);
    } else {
      // otherwise, i clicked a diff guy - select it
      setSelected(obj);
    }

    // if you clicked on a piece, don't ask the cell to do anything
    e.stopPropagation();
  };

  const cellHandler = (): void => {
    if (notMyTurn) return;

    // if selected is null, do nothing
    if (selected === null) return;

    // if it's stageable, stage it
    if (canReallyMove) {
      setStaged([location, selected]);
      return;
    }

    // otherwise, check if the cell is empty
    if (isEmpty) setSelected(null);
  };

  return (
    <td onClick={cellHandler}>
      <StyledGameCell canMove={canReallyMove}>
        {cell.objective && <ObjectivePiece objective={cell.objective} />}
        {[cell.piece, cell.ghost].map(
          (obj, i) =>
            obj && (
              <ChessPiece
                key={i}
                piece={obj}
                onClick={pieceHandler(obj)}
                isSelected={obj.id === selected?.id}
                pos={double ? PiecePos.topLeft : PiecePos.normal}
                disabled={obj.owner !== gm.getAccount() || notMyTurn}
              />
            )
        )}
        {staged && compareLoc(staged[0], location) && (
          <ChessPiece piece={staged[1]} staged isSelected={false} />
        )}
      </StyledGameCell>
    </td>
  );
}

enum TurnState {
  Moving, // no move made
  Submitting, // move submitted to chain
  Waiting, // move confirmed by chain; await other player
}

const StyledGame = styled.div`
  margin: 4em auto;
  width: fit-content;
`;

export function Game() {
  const gm = useContext<AbstractGameManager | null>(GameManagerContext);
  if (!gm) return <>error initializing</>;

  const myColor: Color | null = gm.getColor(gm.getAccount());
  if (!myColor) return <>error with color</>;

  const transform = boardMap(myColor);
  const locMap = boardLocMap(myColor);

  const [turnState, setTurnState] = useState<TurnState>(TurnState.Moving);

  const [gameState, setGameState] = useState<ChessGame>(
    _.cloneDeep(gm.getGameState())
  );
  const board = boardFromGame(gameState);

  // you can hover / select ghosts or pieces - keyed by id
  const selectedHook = useState<Selectable | null>(null);
  const [selected, setSelected] = selectedHook;

  // once a ghost / piece is selected, you can stage it to a location
  const [canMove, setCanMove] = useState<BoardLocation[]>([]);
  const stagedHook = useState<StagedLoc | null>(null);
  const [staged, setStaged] = stagedHook;

  /* attach event listeners */
  // when a move is accepted, wait for a response
  useEffect(() => {
    const doAccept = () => setTurnState(TurnState.Submitting);
    gm.addListener(GameManagerEvent.MoveAccepted, doAccept);

    return () => {
      gm.removeAllListeners(GameManagerEvent.MoveAccepted);
    };
  });

  // when you get a response, sync the game state
  useEffect(() => {
    const doConfirm = () => {
      const newState = gm.getGameState();
      setGameState(_.cloneDeep(newState));
      setSelected(null);

      if (gm.isMyTurn()) {
        setTurnState(TurnState.Moving);
      } else {
        setTurnState(TurnState.Waiting);
      }
    };
    gm.addListener(GameManagerEvent.MoveConfirmed, doConfirm);

    return () => {
      gm.removeAllListeners(GameManagerEvent.MoveConfirmed);
    };
  });

  // sync selected to canMove
  useLayoutEffect(() => {
    setStaged(null);
    if (selected === null) {
      setCanMove([]);
      return;
    }

    setCanMove(getCanMove(selected));
    return;
  }, [selected]);

  const [ghostCanAct, setGhostCanAct] = useState<boolean>(false);
  useEffect(() => {
    if (!selected || staged || !isGhost(selected)) {
      setGhostCanAct(false);
      return;
    }

    // if the cell the ghost is on has an enemy piece
    for (const row of board) {
      for (const cell of row) {
        if (cell.piece && cell.ghost && cell.piece.owner !== cell.ghost.owner) {
          // should always be true, but a fallback just in case
          const fallback = compareLoc(selected.location, cell.ghost.location);
          setGhostCanAct(fallback);
          return;
        }
      }
    }
  }, [selected, staged, gameState]);

  const submitMove = () => {
    if (staged && selected !== null) {
      if (isGhost(selected)) gm.moveGhost(selected.id, staged[0]);
      else gm.movePiece(selected.id, staged[0]);
      setTurnState(TurnState.Submitting);
    }
  };

  const ghostAttack = () => {
    gm.ghostAttack();
    setTurnState(TurnState.Submitting);
  };

  return (
    <StyledGame>
      <StyledGameBoard>
        <tbody>
          {transform(board).map((row: ChessCell[], i: number) => (
            <tr key={i}>
              {row.map((cell: ChessCell, j: number) => {
                const loc: BoardLocation = locMap([i, j]);
                return (
                  <GameCell
                    key={JSON.stringify(loc)}
                    location={loc}
                    cell={cell}
                    selectedHook={selectedHook}
                    canMove={hasLoc(canMove, loc)}
                    stagedHook={stagedHook}
                    turnState={turnState}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </StyledGameBoard>
      <p>
        {turnState === TurnState.Moving && (
          <span>
            your turn! move a piece...{' '}
            {staged && <u onClick={submitMove}>click to confirm</u>}
            {ghostCanAct && <u onClick={ghostAttack}>attack</u>}
          </span>
        )}
        {turnState === TurnState.Submitting && <span>submitting move...</span>}
        {turnState === TurnState.Waiting && (
          <span>move confirmed. awaiting other player...</span>
        )}
      </p>
    </StyledGame>
  );
}
