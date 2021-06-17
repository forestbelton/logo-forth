const [canvas, input, commandList, execute, share] = [
  "canvas",
  "input",
  "command-list",
  "execute",
  "share",
].map((id) => document.getElementById(id));
const ctx = canvas.getContext("2d");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

const executeInput = () => {
  const cpu = new CPU();
  try {
    const code = input.value;
    const tokens = parse(code);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    cpu.evaluate(tokens);
    ctx.beginPath();
    ctx.arc(cpu.x, cpu.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  } catch (e) {
    console.error(e);
    throw e;
  }
};

class CPU {
  constructor() {
    this.x = Math.floor(CANVAS_WIDTH / 2);
    this.y = Math.floor(CANVAS_HEIGHT / 2);
    this.angle = 0;
    this.down = false;
    this.stack = [];
    this.dict = {};
  }

  evaluate(block) {
    block.forEach((token) => {
      this.evaluateToken(token);
    });
  }

  evaluateToken(token) {
    token = this.resolveConstant(token);
    if (token.type === "func") {
      token.value(this);
      return;
    }
    this.push(token);
  }

  invoke(T) {
    if (T.type === "func") {
      T.value(this);
    } else if (T.type === "block") {
      this.evaluate(T.value);
    } else {
      throw `cannot invoke ${T.type}`;
    }
  }

  resolveConstant(T) {
    if (T.type !== "constant") {
      return T;
    }
    if (typeof BUILTINS_DICT[T.value] !== "undefined") {
      T = BUILTINS_DICT[T.value];
    } else if (typeof this.dict[T.value] !== "undefined") {
      T = this.dict[T.value];
    }
    return T;
  }

  pop() {
    return this.resolveConstant(this.stack.pop());
  }

  popNumber() {
    const head = this.pop();
    return typeof head.value === "number" ? head.value : parseFloat(head.value);
  }

  push(type, value) {
    if (typeof value === "undefined") {
      this.stack.push(type);
      return;
    }
    this.stack.push({ type, value });
  }
}

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
      tokens.push(BUILTINS_DICT[raw]);
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
const C = (value) => ({ type: "constant", value });

const BUILTINS_DICT = {};
const BUILTINS_DESC = {};
const newBuiltin = (name, desc, defn) => {
  BUILTINS_DICT[name] = typeof defn === "function" ? T("func", defn) : defn;
  BUILTINS_DESC[name] = desc;
};

newBuiltin("*", "mul <x>, <y>", (cpu) => {
  const [a, b] = [cpu.popNumber(), cpu.popNumber()];
  cpu.push(C(a * b));
});

newBuiltin("+", "sum <x>, <y>", (cpu) => {
  const [a, b] = [cpu.popNumber(), cpu.popNumber()];
  cpu.push(C(a + b));
});

newBuiltin("-", "subtract <x>, <y>", (cpu) => {
  const [a, b] = [cpu.popNumber(), cpu.popNumber()];
  cpu.push(C(a - b));
});

newBuiltin("a", "angle <x>", (cpu) => {
  cpu.angle = cpu.popNumber();
});

newBuiltin("b", "back <x>", (cpu) => {
  const d = cpu.popNumber();
  const { x, y, angle } = cpu;
  cpu.x = x - Math.cos(angle) * d;
  cpu.y = y - Math.sin(angle) * d;
  if (!cpu.down) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cpu.x, cpu.y);
  ctx.stroke();
});

newBuiltin("f", "forward <x>", (cpu) => {
  const d = cpu.popNumber();
  const { x, y, angle } = cpu;
  cpu.x += Math.cos(angle) * d;
  cpu.y += Math.sin(angle) * d;
  if (!cpu.down) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cpu.x, cpu.y);
  ctx.stroke();
});

newBuiltin("d", "pen down", (cpu) => (cpu.down = true));

newBuiltin("u", "pen up", (cpu) => (cpu.down = false));

newBuiltin("r", "rotate cw, <x>", (cpu) => {
  const r = cpu.popNumber();
  cpu.angle += (2 * Math.PI * r) / 360;
  cpu.angle = cpu.angle % (2 * Math.PI);
});

newBuiltin("l", "rotate ccw, <x>", (cpu) => {
  const r = cpu.popNumber();
  cpu.angle -= (2 * Math.PI * r) / 360;
  cpu.angle = cpu.angle % (2 * Math.PI);
});

newBuiltin("c", "do-n <f>, <n>", (cpu) => {
  const [block, count] = [cpu.pop(), cpu.popNumber()];
  for (let i = 0; i < count; i++) {
    cpu.evaluate(block.value);
  }
});

newBuiltin("e", "each <f>, <xs>", (cpu) => {
  const [items, block] = [cpu.pop(), cpu.pop()];
  items.value.forEach((item) => {
    cpu.push(item);
    cpu.evaluate(block.value);
  });
});

newBuiltin("z", "zip <xs>, <ys>", (cpu) => {
  const list2 = cpu.pop().value;
  const list1 = cpu.pop().value;
  const items = [];
  for (let i = 0; i < Math.min(list1.length, list2.length); i++) {
    items.push(T("block", [list1[i], list2[i]]));
  }
  cpu.push("block", items);
});

newBuiltin("x", "expand <xs>", (cpu) => {
  const list = cpu.pop().value;
  list.forEach((item) => {
    cpu.push(item);
  });
});

newBuiltin(".", "duplicate <x>", (cpu) => {
  cpu.push(cpu.stack[cpu.stack.length - 1]);
});

newBuiltin("!", "eval <f>", (cpu) => {
  const f = cpu.pop();
  cpu.invoke(f);
});

newBuiltin("i", "index <xs>, <i>", (cpu) => {
  const [i, xs] = [cpu.popNumber(), cpu.pop()];
  let value = null;
  if (xs.type === "block") {
    value = xs.value[Math.floor(i)];
  } else if (xs.type === "constant") {
    try {
      const number = Math.floor(parseFloat(xs.value)).toString();
      const digitIndex = number.length - Math.floor(i) - 1;
      value = T("constant", digitIndex >= 0 ? number.charAt(digitIndex) : "0");
    } catch (e) {
      console.error(e);
      value = xs;
    }
  }
  if (value !== null) {
    cpu.push(value);
  }
});

newBuiltin("?", "if-else <t>, <f>, <p>", (cpu) => {
  const p = cpu.pop();
  if (p.type === "constant") {
    cpu.push(p);
  } else {
    cpu.invoke(p);
  }
  const [cond, f, t] = [cpu.pop(), cpu.pop(), cpu.pop()];
  cpu.invoke(cond.type === "constant" && cond.value ? t : f);
});

newBuiltin(":", "define <x>, <n>", (cpu) => {
  const [name, value] = [cpu.pop(), cpu.pop()];
  cpu.dict[name.value] = value;
});

[...Object.keys(BUILTINS_DICT)].sort().forEach((name) => {
  const li = document.createElement("li");
  li.innerText = `${name} = ${BUILTINS_DESC[name]}`;
  commandList.appendChild(li);
});

const DEFAULT_PRGM = `d
90 l
[ . 0 i 1 - 45 * r 1 i 10 * f ] F :
[ 55 53 53 72 73 52 72 ] I :
F I e
50 F !
F I e`;

const params = new URLSearchParams(window.location.search);
input.textContent =
  (params.has("prgm") && atob(params.get("prgm"))) || DEFAULT_PRGM;

execute.addEventListener("click", executeInput);
execute.click();

input.addEventListener("change", (ev) => {
  input.textContent = ev.target.value;
  const url = new URL(window.location);
  url.searchParams.set("prgm", btoa(input.textContent));
  window.history.pushState({}, "", url);
});

share.addEventListener("click", (ev) => {
  const button = ev.target;

  const url = new URL(window.location);
  const oldPrgm =
    (url.searchParams.has("prgm") && atob(url.searchParams.get("prgm"))) ||
    null;

  if (oldPrgm !== input.textContent) {
    url.searchParams.set("prgm", btoa(input.textContent));
    window.history.pushState({}, "", url);
  }

  navigator.clipboard.writeText(url.toString()).then(() => {
    button.disabled = true;
    button.textContent = "Copied to clipboard";

    setTimeout(() => {
      button.disabled = false;
      button.textContent = "Share";
    }, 2 * 1000);
  });
});

input.setSelectionRange(
  input.textContent.length - 1,
  input.textContent.length - 1
);
input.focus();
