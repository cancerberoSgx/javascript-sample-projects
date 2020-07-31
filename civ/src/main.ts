import { Board } from "./board";

function main() {
  const board = new Board(20, 20)
  board.draw(document.body)
}

main()
