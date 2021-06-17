const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const input = document.getElementById("input");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

document.getElementById("execute").addEventListener("click", (ev) => {
  const pen = { x: CANVAS_WIDTH / 2, y: CANVAS_WIDTH / 2, dir: 0, down: false };
  const stack = [];

  try {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const code = input.value;
    const tokens = parse(code);
    eval_prgm(tokens, pen, stack);
    ctx.beginPath();
    ctx.arc(pen.x, pen.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  } catch (e) {
    console.error(e);
  }
});

const eval_prgm = (tokens, pen, stack) =>
  tokens.forEach((token) => {
    if (token.type === "func") {
      token.value(pen, stack);
      return;
    }
    stack.push(token);
  });

const parse = (str) => {
  const raw_tokens = str
    .split(/[ \r\t\n]+/)
    .map((raw) => (raw = raw.trim()))
    .filter((raw) => raw !== "");
  const tokens = [];
  parse_it(raw_tokens, 0, tokens);
  return tokens;
};

const parse_it = (raw_tokens, idx0, tokens) => {
  let idx = idx0;
  while (idx < raw_tokens.length) {
    const raw = raw_tokens[idx++];
    if (typeof BUILTINS_DICT[raw] !== "undefined") {
      tokens.push(T("func", BUILTINS_DICT[raw]));
      continue;
    } else if (raw === "[") {
      const block = [];
      idx = parse_it(raw_tokens, idx, block);
      tokens.push(T("block", block));
      continue;
    } else if (raw === "]") {
      break;
    }
    tokens.push(T("constant", raw));
  }
  return idx;
};

const T = (type, value) => ({ type, value });

const popNumber = (stack) => {
  const raw = stack.pop().value;
  return typeof raw === "string" ? parseFloat(raw) : raw;
};

const multiply = (pen, stack) => {
  const a = popNumber(stack);
  const b = popNumber(stack);
  stack.push(T("constant", a * b));
};

const sum = (pen, stack) => {
  const a = popNumber(stack);
  const b = popNumber(stack);
  stack.push(T("constant", a + b));
};

const subtract = (pen, stack) => {
  const a = popNumber(stack);
  const b = popNumber(stack);
  stack.push(T("constant", a - b));
};

const backward = (pen, stack) => {
  const d = popNumber(stack);
  const { x, y } = pen;
  pen.x = pen.x - Math.cos(pen.dir) * d;
  pen.y = pen.y - Math.sin(pen.dir) * d;
  if (!pen.down) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(pen.x, pen.y);
  ctx.stroke();
};

const forward = (pen, stack) => {
  const d = popNumber(stack);
  const { x, y } = pen;
  pen.x = pen.x + Math.cos(pen.dir) * d;
  pen.y = pen.y + Math.sin(pen.dir) * d;
  if (!pen.down) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(pen.x, pen.y);
  ctx.stroke();
};

const pendown = (pen, stack) => {
  pen.down = true;
};

const penup = (pen, stack) => {
  pen.down = false;
};

const rotateright = (pen, stack) => {
  const r = popNumber(stack);
  pen.dir += (2 * Math.PI * r) / 360;
  pen.dir = pen.dir % (2 * Math.PI);
};

const rotateleft = (pen, stack) => {
  const r = popNumber(stack);
  pen.dir -= (2 * Math.PI * r) / 360;
  pen.dir = pen.dir % (2 * Math.PI);
};

const repeat = (pen, stack) => {
  const block = stack.pop();
  const count = popNumber(stack);
  for (let i = 0; i < count; i++) {
    eval_prgm(block.value, pen, stack);
  }
};

const each = (pen, stack) => {
  const items = stack.pop();
  const block = stack.pop();
  items.value.forEach((item) => {
    stack.push(item);
    eval_prgm(block.value, pen, stack);
  });
};

const zip = (pen, stack) => {
  const list2 = stack.pop().value;
  const list1 = stack.pop().value;
  const items = [];
  for (let i = 0; i < Math.min(list1.length, list2.length); i++) {
    items.push(T("block", [list1[i], list2[i]]));
  }
  stack.push(T("block", items));
};

const expand = (pen, stack) => {
  const list = stack.pop().value;
  list.forEach((item) => {
    stack.push(item);
  });
};

const duplicate = (pen, stack) => {
  const item = stack.pop();
  stack.push(item);
  stack.push(item);
};

const index = (pen, stack) => {
  const i = popNumber(stack);
  const item = stack.pop();
  let value = null;
  if (item.type === "block") {
    value = item.value[Math.floor(i)];
  } else if (item.type === "constant") {
    try {
      const number = Math.floor(parseFloat(item.value)).toString();
      const digitIndex = number.length - Math.floor(i) - 1;
      value = T("constant", digitIndex >= 0 ? number.charAt(digitIndex) : "0");
    } catch (e) {
      console.error(e);
      value = item;
    }
  }
  if (value !== null) {
    stack.push(value);
  }
};

const BUILTINS_DICT = {
  "*": multiply,
  "+": sum,
  "-": subtract,
  ".": duplicate,
  b: backward,
  e: each,
  i: index,
  f: forward,
  l: rotateleft,
  d: pendown,
  n: repeat,
  r: rotateright,
  z: zip,
  u: penup,
  x: expand,
};
