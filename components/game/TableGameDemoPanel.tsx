"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx";
import { FaLeftLong } from "react-icons/fa6";
import DefenseBlock from "@/components/towers/DefenseBlock";
import RegularBlock from "@/components/towers/RegularBlock";
import Button from "@/components/ui/Button";
import { BOARD_COLS } from "@/constants/game";
import { TablePanelView } from "@/enums/table-panel-view";
import { TowersBlockLetter } from "@/server/towers/game/PieceBlock";
import { padBoardToMaxCells, splitIntoColumns } from "@/utils/array";

interface PieceBlockPosition {
  x: number
  y: number
}

interface PowerBlockDemo {
  letter: TowersBlockLetter
  attackLabel: string
  defenseLabel: string
}

interface TableChangeKeysPanelProps {
  nextGameCountdown: number | null
  onChangeView: (view: TablePanelView) => void
}

const DEFAULT_ATTACK_BOARD = padBoardToMaxCells([
  "",
  "",
  "",
  "",
  "blue",
  "",
  "",
  "",
  "blue",
  "gray",
  "orange",
  "purple",
  "blue",
  "gray",
  "blue",
  "gray",
  "green",
  "purple",
  "blue",
  "green",
  "yellow",
  "purple",
  "gray",
  "orange",
  "yellow",
  "green",
  "blue",
  "orange",
  "orange",
  "gray",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "green",
  "green",
  "yellow",
  "blue",
  "purple",
  "orange",
  "yellow",
]);

const DEFAULT_DEFENSE_BOARD = padBoardToMaxCells([
  "",
  "",
  "",
  "",
  "green",
  "",
  "gray",
  "",
  "",
  "",
  "purple",
  "",
  "gray",
  "",
  "",
  "",
  "green",
  "",
  "blue",
  "medusa",
  "yellow",
  "purple",
  "gray",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "yellow",
  "gray",
  "orange",
  "gray",
  "medusa",
  "blue",
  "green",
  "green",
  "green",
  "yellow",
  "blue",
  "purple",
  "orange",
  "gray",
  "orange",
  "gray",
  "medusa",
  "blue",
  "yellow",
  "gray",
  "blue",
  "yellow",
  "green",
  "purple",
  "orange",
  "purple",
]);

export default function TableGameDemoPanel({ nextGameCountdown, onChangeView }: TableChangeKeysPanelProps): ReactNode {
  const { i18n, t } = useLingui();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoPaused, setIsVideoPaused] = useState<boolean>(false);
  const [letters, setLetters] = useState<TowersBlockLetter[]>(["U", "P", "!"]);
  const [position, setPosition] = useState<PieceBlockPosition>({ x: 28, y: 28 });
  const [arrowPressed, setArrowPressed] = useState<string | null>(null);
  const randomArrow: string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowDown", "center"];
  const powerBlocks: PowerBlockDemo[] = [
    { letter: "Y", attackLabel: t({ message: "Add Row" }), defenseLabel: t({ message: "Remove Row" }) },
    { letter: "O", attackLabel: t({ message: "Dither" }), defenseLabel: t({ message: "Clump" }) },
    { letter: "U", attackLabel: t({ message: "Add Stones" }), defenseLabel: t({ message: "Drop Stones" }) },
    { letter: "P", attackLabel: t({ message: "Defuse" }), defenseLabel: t({ message: "Color Blast" }) },
    { letter: "I", attackLabel: t({ message: "Medusa Piece" }), defenseLabel: t({ message: "Midas Piece" }) },
    { letter: "!", attackLabel: t({ message: "Remove Powers" }), defenseLabel: t({ message: "Remove Color" }) },
  ];
  const powerColumns: PowerBlockDemo[][] = splitIntoColumns<PowerBlockDemo>(powerBlocks, 3);
  const [visibleBlockPowerType, setVisibleBlockPowerType] = useState<"attack" | "defense">("attack");
  const [visiblePowerBlocks, setVisiblePowerBlocks] = useState<PowerBlockDemo[]>([]);
  const [activePowerBlockIndex, setActivePowerBlockIndex] = useState<number | null>(null);
  const [isSpaceBarPressed, setIsSpaceBarPressed] = useState<boolean>(false);
  const [attackBoard, setAttackBoard] = useState<string[]>(DEFAULT_ATTACK_BOARD);
  const [defenseBoard, setDefenseBoard] = useState<string[]>(DEFAULT_DEFENSE_BOARD);

  const startVideo = (): void => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsVideoPaused(false);
    }
  };

  const pauseVideo = (): void => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPaused(true);
    }
  };

  const handleDemoVideo = (): void => {
    if (isVideoPaused) {
      startVideo();
    } else {
      pauseVideo();
    }
  };

  const handleVideoEnded = (): void => {
    setIsVideoPaused(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsVideoPaused(false);
      }
    }, 3000);
  };

  const handleKeyClick = (key: string): void => {
    setArrowPressed(key);

    switch (key) {
      case "ArrowUp":
        setPosition({ x: 28, y: -14 });
        setLetters((prev: TowersBlockLetter[]) => {
          const rotated: TowersBlockLetter[] = [...prev];
          const firstLetter: TowersBlockLetter = rotated.shift()!;
          rotated.push(firstLetter);
          return rotated;
        });
        break;
      case "ArrowDown":
        setPosition({ x: 28, y: 70 });
        break;
      case "ArrowLeft":
        setPosition({ x: 0, y: 28 });
        break;
      case "ArrowRight":
        setPosition({ x: 56, y: 28 });
        break;
      default:
        setPosition({ x: 28, y: 28 });
        break;
    }

    setTimeout(() => setArrowPressed(null), 200);
  };

  const keyboardKeyClasses = (key: string): string =>
    `overflow-hidden flex w-10 h-10 pl-0.5 border-t-4 border-t-[#D6D7BD] border-r-4 border-r-[#D6D7BD] border-b-4 border-b-[#5E4511] border-l-4 border-l-[#5E4511] rounded-xs ring-1 ring-black shadow-sm bg-[#ECE3D7] text-black font-medium line-clamp-1 transition-transform duration-100 ${
      arrowPressed === key || (key === "Space" && isSpaceBarPressed) ? "scale-90 bg-[#A1978A]" : ""
    }`;

  const powerBarClasses: string =
    "flex flex-col-reverse w-5 h-full p-0.5 border border-gray-200 mb-2 bg-neutral-600 dark:border-slate-500 dark:bg-slate-600";

  const renderRegularBlock = ({ letter }: { letter: TowersBlockLetter }): ReactNode => (
    <div
      className={`flex items-center justify-center w-demo-block h-demo-block box-border block-${letter === "!" ? "x" : letter.toLowerCase()}`}
    >
      <RegularBlock letter={letter} />
    </div>
  );

  const renderAttackBlock = ({ letter, attackLabel, defenseLabel }: PowerBlockDemo): ReactNode => (
    <li key={letter} className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center w-demo-block h-demo-block box-border block-${letter === "!" ? "x" : letter.toLowerCase()} ${visibleBlockPowerType}-block`}
      >
        {visibleBlockPowerType === "defense" ? <DefenseBlock letter={letter} /> : <RegularBlock letter={letter} />}
      </div>
      <span>{visibleBlockPowerType === "defense" ? defenseLabel : attackLabel}</span>
    </li>
  );

  useEffect(() => {
    startVideo();
  }, []);

  useEffect(() => {
    setPosition({ x: 28, y: 28 });

    let index: number = 0;

    const interval: NodeJS.Timeout = setInterval(() => {
      const currentArrow: string = randomArrow[index];

      handleKeyClick(currentArrow);
      index++;

      if (index >= randomArrow.length) {
        index = 0;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let index: number = 0;
    let isPaused: boolean = false;
    let interval: NodeJS.Timeout;
    let spacebarTimer: NodeJS.Timeout;
    let pauseTimer: NodeJS.Timeout;

    const tick = () => {
      if (isPaused) return;

      setActivePowerBlockIndex(index);

      // Show all blocks from bottom up to current index
      setVisiblePowerBlocks(powerBlocks.slice(index));

      spacebarTimer = setTimeout(() => {
        setIsSpaceBarPressed(true);
        setTimeout(() => setIsSpaceBarPressed(false), 200);
      }, 1500);

      const isLastBlock: boolean = index === powerBlocks.length - 1;

      if (isLastBlock) {
        isPaused = true;

        pauseTimer = setTimeout(() => {
          // Switch block type and reset
          setVisibleBlockPowerType((prev: "attack" | "defense") => {
            if (prev === "defense") {
              setAttackBoard(DEFAULT_ATTACK_BOARD);
              setDefenseBoard(DEFAULT_DEFENSE_BOARD);
              return "attack";
            }

            return "defense";
          });

          setActivePowerBlockIndex(null);
          setVisiblePowerBlocks([]);
          index = 0;
          isPaused = false;
        }, 3000);
      } else {
        index++;
      }
    };

    interval = setInterval(tick, 5000);
    tick();

    return () => {
      clearInterval(interval);
      clearTimeout(spacebarTimer);
      clearTimeout(pauseTimer);
    };
  }, []);

  useEffect(() => {
    if (activePowerBlockIndex === null || !isSpaceBarPressed) return;

    const letter: TowersBlockLetter = powerBlocks[activePowerBlockIndex].letter;

    if (letter === "Y") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) =>
          Array(BOARD_COLS)
            .fill(null)
            .concat(prev.slice(0, prev.length - BOARD_COLS)),
        );
      } else {
        setAttackBoard((prev) => prev.concat(["blue", "purple", "green", "orange", "yellow", "gray"]).slice(BOARD_COLS));
      }
    } else if (letter === "O") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 19] = "orange";
          board[board.length - 21] = "blue";
          board[board.length - 30] = "yellow";

          return board;
        });
      } else {
        setAttackBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 2] = "green";
          board[board.length - 11] = "orange";
          board[board.length - 20] = "yellow";

          return board;
        });
      }
    } else if (letter === "U") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 10] = "medusa";
          board[board.length - 16] = "blue";

          board[board.length - 5] = "medusa";
          board[board.length - 11] = "gray";
          board[board.length - 17] = "yellow";
          board[board.length - 23] = "gray";
          board[board.length - 29] = "green";

          return board;
        });
      } else {
        setAttackBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 6] = "medusa";
          board[board.length - 13] = "medusa";
          board[board.length - 24] = "medusa";

          return board;
        });
      }
    } else if (letter === "P") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 19] = "purple";
          board[board.length - 20] = "purple";
          board[board.length - 21] = "purple";
          board[board.length - 25] = "purple";
          board[board.length - 26] = "purple";
          board[board.length - 27] = "purple";
          board[board.length - 32] = "purple";

          return board;
        });
      } else {
        setAttackBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 9] = "medusa";
          board[board.length - 27] = "medusa";
          board[board.length - 31] = "medusa";
          board[board.length - 37] = "medusa";

          return board;
        });
      }
    } else if (letter === "I") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 19] = "green";
          board[board.length - 20] = "";
          board[board.length - 21] = "";
          board[board.length - 25] = "";
          board[board.length - 26] = "";
          board[board.length - 27] = "";
          board[board.length - 32] = "";
          board[board.length - 38] = "";
          board[board.length - 43] = "";
          board[board.length - 44] = "";

          board[board.length - 29] = "yellow";
          board[board.length - 30] = "yellow";
          board[board.length - 36] = "yellow";
          board[board.length - 42] = "yellow";

          return board;
        });
      } else {
        setAttackBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 44] = "medusa";

          return board;
        });
      }
    } else if (letter === "!") {
      if (visibleBlockPowerType === "defense") {
        setDefenseBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 24] = "";
          board[board.length - 28] = "";
          board[board.length - 29] = "";
          board[board.length - 30] = "";
          board[board.length - 36] = "";
          board[board.length - 42] = "";

          return board;
        });
      } else {
        setAttackBoard((prev) => {
          const board: string[] = [...prev];

          board[board.length - 9] = "blue";
          board[board.length - 14] = "green";

          return board;
        });
      }
    }
  }, [activePowerBlockIndex, visibleBlockPowerType, isSpaceBarPressed]);

  return (
    <div
      className={clsx(
        "flex justify-center items-center border border-gray-200",
        "dark:border-dark-game-content-border",
      )}
    >
      <div className="grid grid-rows-[1fr_auto] grid-cols-12 gap-4 max-w-5xl">
        {/* Demo */}
        <div className="col-span-3 flex flex-col gap-2 items-center justify-end mb-2">
          <video ref={videoRef} muted autoPlay onEnded={handleVideoEnded}>
            <source src="/videos/towers-demo.webm" type="video/webm" />
            <Trans>Your browser does not support the video tag.</Trans>
          </video>

          <Button type="button" onClick={handleDemoVideo}>
            {isVideoPaused ? t({ message: "Resume Demo" }) : t({ message: "Pause Demo" })}
          </Button>
        </div>

        <div
          className={clsx(
            "col-span-9 flex flex-col gap-2 p-2 border border-gray-200 bg-gray-50",
            "dark:border-dark-game-content-border dark:bg-slate-700",
          )}
        >
          {/* Banner */}
          <div className={clsx("w-full bg-gray-200 text-center font-semibold", "dark:bg-slate-800")}>
            <Trans>Your mission: Remove blocks from your and your partner’s boards!</Trans>
          </div>

          <div className="grid grid-cols-[200px_auto] gap-2 h-full">
            <div className="flex flex-col items-center gap-2" dir="ltr">
              {/* Arrow Keys */}
              <div className="grid grid-rows-5 grid-cols-5 w-full h-full">
                <div className="col-span-5 flex justify-center">
                  <div
                    className={clsx(keyboardKeyClasses("ArrowUp"), "justify-start items-end")}
                    aria-label={t({ message: "Move Up" })}
                  >
                    ↑
                  </div>
                </div>
                <div className="row-span-3 flex items-center justify-start">
                  <div
                    className={clsx(keyboardKeyClasses("ArrowLeft"), "justify-start items-end")}
                    aria-label={t({ message: "Move Left" })}
                  >
                    ←
                  </div>
                </div>
                <div className="row-span-3 col-span-3 flex items-center justify-center p-1">
                  <div className="relative w-[84px] h-[140px]">
                    {letters.map((letter: TowersBlockLetter, index: number) => (
                      <div
                        key={index}
                        className="absolute w-demo-block h-demo-block"
                        style={{
                          top: `${position.y + index * 28}px`,
                          left: `${position.x}px`,
                          transition: "top 0.3s, left 0.3s",
                        }}
                      >
                        {renderRegularBlock({ letter })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="row-span-3 flex items-center justify-end">
                  <div
                    className={clsx(keyboardKeyClasses("ArrowRight"), "justify-start items-end")}
                    aria-label={t({ message: "Move Right" })}
                  >
                    →
                  </div>
                </div>
                <div className="col-span-5 flex items-end justify-center">
                  <div
                    className={clsx(keyboardKeyClasses("ArrowDown"), "justify-start items-end")}
                    aria-label={t({ message: "Move Down" })}
                  >
                    ↓
                  </div>
                </div>
              </div>

              <hr className={clsx("w-11/12 my-1 border border-gray-200", "dark:border-slate-500")} />

              {/* Team */}
              <div className="flex items-end text-center">
                <Image
                  src={`/images/towers/demo-team-${i18n.locale === "pseudo-LOCALE" ? "en" : i18n.locale}.jpg`}
                  width={200}
                  height={105}
                  alt={t({ message: "Team" })}
                />
              </div>
            </div>

            {/* Attacks + You/Opponent boards */}
            <div className={clsx("flex flex-col gap-2 bg-gray-100", "dark:bg-slate-700")}>
              {/* Power Blocks */}
              <div className="px-4 mb-4">
                <div className="text-lg font-bold text-center">
                  {visibleBlockPowerType === "defense"
                    ? t({ message: "Defense Power Blocks" })
                    : t({ message: "Attack Power Blocks" })}
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {powerColumns.map((column: PowerBlockDemo[], index: number) => (
                    <ul key={index} className="flex-1 flex flex-col gap-2">
                      {column.map(({ letter, attackLabel, defenseLabel }: PowerBlockDemo) =>
                        renderAttackBlock({ letter, attackLabel, defenseLabel }),
                      )}
                    </ul>
                  ))}
                </div>
              </div>

              {/* Attack Boards */}
              <div className="flex flex-col align-end">
                <div className="w-1/2 mx-auto text-center">
                  {visibleBlockPowerType === "defense"
                    ? t({ message: "Defenses repair your team's boards." })
                    : t({ message: "Attacks damage opponents' boards." })}
                </div>

                <div className="flex flex-1 items-end justify-center gap-4 p-2">
                  {/* You */}
                  <div className="flex flex-col items-center">
                    <div className="flex gap-1">
                      <div
                        className={clsx(
                          "relative grid grid-cols-6 w-24 aspect-[6/13] border border-gray-200 bg-neutral-600",
                          "before:content-[attr(data-player)] before:absolute before:top-1 before:start-1/2 before:-translate-x-1/2 before:text-white before:text-sm before:font-medium before:text-center",
                          "rtl:before:translate-x-1/2",
                          "dark:border-slate-500 dark:bg-slate-600",
                        )}
                        data-player={t({ message: "You" })}
                      >
                        {defenseBoard.map((color: string, index: number) => (
                          <div
                            key={index}
                            className={clsx("w-full aspect-square", {
                              "block-y": color === "gray",
                              "block-o": color === "green",
                              "block-u": color === "blue",
                              "block-p": color === "purple",
                              "block-i": color === "yellow",
                              "block-x": color === "orange",
                              "block-medusa": color === "medusa",
                            })}
                          />
                        ))}
                      </div>
                      <div className="relative flex flex-col gap-2">
                        <div className={powerBarClasses}>
                          {visiblePowerBlocks.map(({ letter }: { letter: TowersBlockLetter }, index: number) => (
                            <div key={index} className={"relative flex items-center"}>
                              <div
                                className={`w-full h-full aspect-square block-${letter === "!" ? "x" : letter.toLowerCase()} ${visibleBlockPowerType}-block`}
                              />

                              {index === 0 && (
                                <div
                                  key={`${letter}-${visibleBlockPowerType}`} // Force remount - animation fix
                                  className={clsx(
                                    "absolute start-0 flex flex-col items-center text-center animate-demo-slide-power-block",
                                    "rtl:animate-demo-slide-power-block-rtl",
                                  )}
                                >
                                  {/* Power name */}
                                  {activePowerBlockIndex !== null && (
                                    <div className="w-32 font-medium">
                                      {visibleBlockPowerType === "defense"
                                        ? powerBlocks[activePowerBlockIndex].defenseLabel
                                        : powerBlocks[activePowerBlockIndex].attackLabel}
                                    </div>
                                  )}

                                  {/* Power block */}
                                  <div
                                    className={`w-6 aspect-square block-${letter === "!" ? "x" : letter.toLowerCase()} ${visibleBlockPowerType}-block`}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                        </div>

                        {/* Use power button */}
                        <div
                          className={clsx(
                            keyboardKeyClasses("Space"),
                            "justify-center items-center w-32 h-10 ms-4 text-sm uppercase",
                          )}
                        >
                          <Trans>Space bar</Trans>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Opponent */}
                  <div className="flex flex-col items-center">
                    <div className="flex gap-1">
                      <div
                        className={clsx(
                          "relative grid grid-cols-6 w-24 aspect-[6/13] border border-gray-200 bg-neutral-600",
                          "before:content-[attr(data-player)] before:absolute before:top-1 before:start-1/2 before:-translate-x-1/2 before:text-white before:text-sm before:font-medium before:text-center",
                          "rtl:before:translate-x-1/2",
                          "dark:border-slate-500 dark:bg-slate-600",
                        )}
                        data-player={t({ message: "Opponent" })}
                      >
                        {attackBoard.map((color: string, index: number) => (
                          <div
                            key={index}
                            className={clsx("w-full aspect-square", {
                              "block-y": color === "gray",
                              "block-o": color === "green",
                              "block-u": color === "blue",
                              "block-p": color === "purple",
                              "block-i": color === "yellow",
                              "block-x": color === "orange",
                              "block-medusa": color === "medusa",
                            })}
                          />
                        ))}
                      </div>
                      <div className="mb-11">
                        <div className={powerBarClasses}>
                          <div className="aspect-square block-y attack-block" />
                          <div className="aspect-square block-p defense-block" />
                          <div className="aspect-square block-o defense-block" />
                          <div className="aspect-square block-i attack-block" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                          <div className="aspect-square bg-neutral-600 dark:bg-slate-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="col-span-12 flex gap-2 justify-center items-center py-1">
          <div className="relative">
            <Button type="button" onClick={() => onChangeView(TablePanelView.GAME)}>
              <Trans>OK, I’m ready to play</Trans>
            </Button>

            {nextGameCountdown && (
              <div className="absolute top-1/2 start-full flex justify-start items-center gap-2 w-auto ms-4 transform -translate-y-1/2">
                <FaLeftLong className="rtl:rotate-180" />
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span>
                    <Trans>Next game starting...</Trans>
                  </span>
                  <span className="text-orange-400 text-xl font-bold">{nextGameCountdown}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
