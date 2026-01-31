import { ReactNode } from "react";
import { PieceBlockLetter } from "@/server/towers/game/pieces/piece-block";

type DefenseBlockProps = {
  letter?: PieceBlockLetter
};

export default function DefenseBlock({ letter }: DefenseBlockProps): ReactNode {
  return (
    <>
      {typeof letter !== "undefined" ? (
        <>
          <div className="block-cube--face block-cube--front">{letter}</div>
          <div className="block-cube--face block-cube--right">{letter}</div>
          <div className="block-cube--face block-cube--back">{letter}</div>
          <div className="block-cube--face block-cube--left">{letter}</div>
          <div className="block-cube--face block-cube--top"></div>
          <div className="block-cube--face block-cube--bottom"></div>
        </>
      ) : (
        <div className="w-full h-[inherit] bg-inherit text-inherit" />
      )}
    </>
  );
}
