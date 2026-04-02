'use strict';

import { Injectable, OnModuleInit } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enumerate, makeBet, makeMultiTierBet } = require('./baccarat-enum');

// ── 牌靴工具 ────────────────────────────────────────────────
function initDeck(): Record<number, number> {
  const deck: Record<number, number> = {};
  for (let v = 1; v <= 9; v++) deck[v] = 32;
  deck[0] = 128;
  return deck;
}

function totalCards(deck: Record<number, number>): number {
  return Object.values(deck).reduce((s, c) => s + c, 0);
}

// 判断头两张是否为例牌（天牌，8或9点）
function isNatural(cards: number[]): boolean {
  return (cards[0] + cards[1]) % 10 >= 8;
}

// ── 精确枚举计算 ─────────────────────────────────────────────
function calculateProbability(deck: Record<number, number>): any {
  const arr = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) arr[v] = deck[v] || 0;
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;

  const pNatural = makeBet((h: any) => h.winner === 'player' && isNatural(h.pCards), 1);
  const pWin9    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 9, 30);
  const pWin8    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 8, 10);
  const pWin7    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 7, 5);
  const pWin6    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 6, 3);
  const pWin5    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 5, 2);
  const pWin4    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 4, 1);
  const bNatural = makeBet((h: any) => h.winner === 'banker' && isNatural(h.bCards), 1);
  const bWin9    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 9, 30);
  const bWin8    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 8, 10);
  const bWin7    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 7, 5);
  const bWin6    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 6, 3);
  const bWin5    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 5, 2);
  const bWin4    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 4, 1);

  const superSeven = makeMultiTierBet([
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 4, payout: 30 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 5, payout: 40 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 6, payout: 100 },
  ]);
  const natural7  = makeBet((h: any) => h.pCount === 2 && h.pTotal === 7 && h.winner === 'player', 15);
  const three7    = makeBet((h: any) => h.pCount === 3 && h.pTotal === 7 && h.winner === 'player', 30);
  const combo7    = makeMultiTierBet([
    { condition: (h: any) => h.pCount === 2 && h.pTotal === 7 && h.winner === 'player', payout: 6 },
    { condition: (h: any) => h.pCount === 3 && h.pTotal === 7 && h.winner === 'player', payout: 15 },
  ]);
  const banker6Two   = makeBet((h: any) => h.bCount === 2 && h.bTotal === 6 && h.winner === 'banker', 22);
  const banker6Three = makeBet((h: any) => h.bCount === 3 && h.bTotal === 6 && h.winner === 'banker', 50);
  const banker6Combo = makeMultiTierBet([
    { condition: (h: any) => h.bCount === 2 && h.bTotal === 6 && h.winner === 'banker', payout: 12 },
    { condition: (h: any) => h.bCount === 3 && h.bTotal === 6 && h.winner === 'banker', payout: 20 },
  ]);

  enumerate(arr, [superSeven, natural7, three7, combo7, banker6Two, banker6Three, banker6Combo,
    pNatural, pWin9, pWin8, pWin7, pWin6, pWin5, pWin4,
    bNatural, bWin9, bWin8, bWin7, bWin6, bWin5, bWin4]);

  const s7 = superSeven.result();
  return {
    prob: s7.prob,
    ev:   s7.ev,
    probNatural7:   natural7.result().prob,
    evNatural7:     natural7.result().ev,
    probThree7:     three7.result().prob,
    evThree7:       three7.result().ev,
    probCombo:      combo7.result().prob,
    evCombo:        combo7.result().ev,
    probBanker6Two:   banker6Two.result().prob,
    evBanker6Two:     banker6Two.result().ev,
    probBanker6Three: banker6Three.result().prob,
    evBanker6Three:   banker6Three.result().ev,
    probBanker6Combo: banker6Combo.result().prob,
    evBanker6Combo:   banker6Combo.result().ev,
    dragon: {
      player: {
        natural: pNatural.result(),
        win9: pWin9.result(), win8: pWin8.result(), win7: pWin7.result(),
        win6: pWin6.result(), win5: pWin5.result(), win4: pWin4.result(),
      },
      banker: {
        natural: bNatural.result(),
        win9: bWin9.result(), win8: bWin8.result(), win7: bWin7.result(),
        win6: bWin6.result(), win5: bWin5.result(), win4: bWin4.result(),
      },
    },
    remaining: N,
  };
}

function calcDragonEV(deck: Record<number, number>): { player: number; banker: number } | null {
  const arr = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) arr[v] = deck[v] || 0;
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;

  const pNatural = makeBet((h: any) => h.winner === 'player' && isNatural(h.pCards), 1);
  const pWin9    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 9, 30);
  const pWin8    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 8, 10);
  const pWin7    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 7, 5);
  const pWin6    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 6, 3);
  const pWin5    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 5, 2);
  const pWin4    = makeBet((h: any) => h.winner === 'player' && !isNatural(h.pCards) && (h.pTotal - h.bTotal) === 4, 1);
  const bNatural = makeBet((h: any) => h.winner === 'banker' && isNatural(h.bCards), 1);
  const bWin9    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 9, 30);
  const bWin8    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 8, 10);
  const bWin7    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 7, 5);
  const bWin6    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 6, 3);
  const bWin5    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 5, 2);
  const bWin4    = makeBet((h: any) => h.winner === 'banker' && !isNatural(h.bCards) && (h.bTotal - h.pTotal) === 4, 1);

  enumerate(arr, [pNatural, pWin9, pWin8, pWin7, pWin6, pWin5, pWin4,
                  bNatural, bWin9, bWin8, bWin7, bWin6, bWin5, bWin4]);

  function net(bets: any[]): number {
    let ev = 0, prob = 0;
    for (const b of bets) { const r = b.result(); ev += r.ev; prob += r.prob; }
    return ev - (1 - prob);
  }
  return {
    player: net([pNatural, pWin9, pWin8, pWin7, pWin6, pWin5, pWin4]),
    banker: net([bNatural, bWin9, bWin8, bWin7, bWin6, bWin5, bWin4]),
  };
}

function calcCardImpact(deck: Record<number, number>): any[] | null {
  const base = calcDragonEV(deck);
  if (!base) return null;
  const impact: any[] = [];
  for (let v = 0; v <= 9; v++) {
    if (!deck[v]) {
      impact.push({ v, player: null, banker: null });
      continue;
    }
    const d2 = Object.assign({}, deck);
    d2[v]--;
    const ev2 = calcDragonEV(d2);
    if (!ev2) {
      impact.push({ v, player: null, banker: null });
    } else {
      impact.push({
        v,
        player: ev2.player - base.player,
        banker: ev2.banker - base.banker,
      });
    }
  }
  return impact;
}

function calcSuperSevenEV2(arr: number[]): number | null {
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;
  const s7 = makeMultiTierBet([
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 4, payout: 30 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 5, payout: 40 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 6, payout: 100 },
  ]);
  enumerate(arr, [s7]);
  const r = s7.result();
  return r.ev - (1 - r.prob);
}

function calcSuperSevenImpact(deck: Record<number, number>): any[] | null {
  const arr0 = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) arr0[v] = deck[v] || 0;
  const N = arr0.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;

  const base = calcSuperSevenEV2(arr0);
  const impact: any[] = [];
  for (let v = 0; v <= 9; v++) {
    if (!arr0[v]) {
      impact.push({ v, delta: null });
      continue;
    }
    const arr2 = arr0.slice();
    arr2[v]--;
    const ev2 = calcSuperSevenEV2(arr2);
    impact.push({ v, delta: ev2 !== null ? ev2 - (base as number) : null });
  }
  return impact;
}

function calcLucky6Impact(deck: Record<number, number>): any[] | null {
  const arr0 = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) arr0[v] = deck[v] || 0;
  const N = arr0.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;

  function calcEVs(arr: number[]): { two: number; three: number } {
    const l6two   = makeBet((h: any) => h.bCount === 2 && h.bTotal === 6 && h.winner === 'banker', 22);
    const l6three = makeBet((h: any) => h.bCount === 3 && h.bTotal === 6 && h.winner === 'banker', 50);
    enumerate(arr, [l6two, l6three]);
    const r2 = l6two.result(), r3 = l6three.result();
    return {
      two:   r2.ev - (1 - r2.prob),
      three: r3.ev - (1 - r3.prob),
    };
  }

  const base = calcEVs(arr0);
  const impact: any[] = [];
  for (let v = 0; v <= 9; v++) {
    if (!arr0[v]) {
      impact.push({ v, two: null, three: null });
      continue;
    }
    const arr2 = arr0.slice();
    arr2[v]--;
    const ev2 = calcEVs(arr2);
    impact.push({
      v,
      two:   ev2.two   - base.two,
      three: ev2.three - base.three,
    });
  }
  return impact;
}

function calcNetEVs(deck: Record<number, number>): any | null {
  const result = calculateProbability(deck);
  if (!result) return null;
  const keys = ['natural', 'win9', 'win8', 'win7', 'win6', 'win5', 'win4'];
  function dragonNet(side: any): number {
    let ev = 0, prob = 0;
    for (const k of keys) { ev += side[k].ev; prob += side[k].prob; }
    return ev - (1 - prob);
  }
  return {
    playerDragon: dragonNet(result.dragon.player),
    bankerDragon: dragonNet(result.dragon.banker),
    superSeven:   result.ev - (1 - result.prob),
    lucky6:       result.evBanker6Combo - (1 - result.probBanker6Combo),
  };
}

function simulateDealing(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  const bettable = { playerDragon: 0, bankerDragon: 0, superSeven: 0, lucky6: 0 };
  let actualHands = 0;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        draw();
      }
    }

    const deck: Record<number, number> = {};
    for (let v = 0; v <= 9; v++) deck[v] = 0;
    for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

    const evs = calcNetEVs(deck);
    if (evs) {
      if (evs.playerDragon > THRESHOLD) bettable.playerDragon++;
      if (evs.bankerDragon > THRESHOLD) bettable.bankerDragon++;
      if (evs.superSeven   > THRESHOLD) bettable.superSeven++;
      if (evs.lucky6       > THRESHOLD) bettable.lucky6++;
    }
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;
  return { deck, bettable, actualHands };
}

function calcSuperSevenEV(arr: number[]): number | null {
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;
  const s7 = makeMultiTierBet([
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 4, payout: 30 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 5, payout: 40 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 6, payout: 100 },
  ]);
  enumerate(arr, [s7]);
  const r = s7.result();
  return r.ev - (1 - r.prob);
}

function simulateSuperSeven(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  const S7_PAYOUTS: Record<number, number> = { 4: 30, 5: 40, 6: 100 };
  let bettable = 0;
  let actualHands = 0;
  const bettableHands: any[] = [];
  let pendingBet: any = null;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null, b3: number | null = null;
    let cardCount = 4;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
        cardCount++;
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        b3 = draw();
        cardCount++;
      }
    }

    if (pendingBet !== null) {
      const finalPT = p3 !== null ? (p1 + p2 + p3) % 10 : pT;
      const finalBT = b3 !== null ? (b1 + b2 + b3) % 10 : bT;
      const hit = finalPT === 7 && finalBT === 6;
      const payout = hit ? (S7_PAYOUTS[cardCount] || 0) : 0;
      pendingBet.nextResult = { hit, payout, cardCount: hit ? cardCount : null };
      bettableHands.push(pendingBet);
      pendingBet = null;
    }

    const arr = new Array(10).fill(0);
    for (let i = pos; i < shoe.length; i++) arr[shoe[i]]++;
    if (remaining() >= 104) {
      const ev = calcSuperSevenEV(arr);
      if (ev !== null && ev > THRESHOLD) {
        bettable++;
        pendingBet = { hand: actualHands, edge: parseFloat((-ev * 100).toFixed(4)) };
      }
    }
  }

  if (pendingBet !== null) {
    pendingBet.nextResult = { hit: false, payout: 0, cardCount: null, noNextHand: true };
    bettableHands.push(pendingBet);
    pendingBet = null;
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

  const finalArr = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) finalArr[v] = deck[v];
  const s7Final = makeMultiTierBet([
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 4, payout: 30 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 5, payout: 40 },
    { condition: (h: any) => h.pTotal === 7 && h.bTotal === 6 && h.cardCount === 6, payout: 100 },
  ]);
  enumerate(finalArr, [s7Final]);
  const finalR = s7Final.result();

  return { deck, bettable, actualHands, bettableHands, prob: finalR.prob, ev: finalR.ev };
}

function calcLucky6ThreeEV(arr: number[]): number | null {
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;
  const l6 = makeBet((h: any) => h.bCount === 3 && h.bTotal === 6 && h.winner === 'banker', 50);
  enumerate(arr, [l6]);
  const r = l6.result();
  return r.ev - (1 - r.prob);
}

function simulateLucky6Three(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  let bettable = 0;
  let actualHands = 0;
  const bettableHands: any[] = [];
  let pendingBet: any = null;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null, b3: number | null = null;
    let bCount = 2;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        b3 = draw();
        bCount = 3;
      }
    }

    if (pendingBet !== null) {
      const finalBT = b3 !== null ? (b1 + b2 + b3) % 10 : bT;
      const finalPT = p3 !== null ? (p1 + p2 + p3) % 10 : pT;
      const hit = bCount === 3 && finalBT === 6 && finalBT > finalPT;
      pendingBet.nextResult = { hit, payout: hit ? 50 : 0 };
      bettableHands.push(pendingBet);
      pendingBet = null;
    }

    const arr = new Array(10).fill(0);
    for (let i = pos; i < shoe.length; i++) arr[shoe[i]]++;
    if (remaining() >= 104) {
      const ev = calcLucky6ThreeEV(arr);
      if (ev !== null && ev > THRESHOLD) {
        bettable++;
        pendingBet = { hand: actualHands, edge: parseFloat((-ev * 100).toFixed(4)) };
      }
    }
  }

  if (pendingBet !== null) {
    pendingBet.nextResult = { hit: false, payout: 0, noNextHand: true };
    bettableHands.push(pendingBet);
    pendingBet = null;
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

  const finalArr = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) finalArr[v] = deck[v];
  const l6Final = makeBet((h: any) => h.bCount === 3 && h.bTotal === 6 && h.winner === 'banker', 50);
  enumerate(finalArr, [l6Final]);
  const finalR = l6Final.result();

  return { deck, bettable, actualHands, bettableHands, prob: finalR.prob, ev: finalR.ev };
}

function calcLucky6TwoEV(arr: number[]): number | null {
  const N = arr.reduce((a: number, b: number) => a + b, 0);
  if (N < 6) return null;
  const l6 = makeBet((h: any) => h.bCount === 2 && h.bTotal === 6 && h.winner === 'banker', 22);
  enumerate(arr, [l6]);
  const r = l6.result();
  return r.ev - (1 - r.prob);
}

function simulateLucky6Two(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  let bettable = 0;
  let actualHands = 0;
  const bettableHands: any[] = [];
  let pendingBet: any = null;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null, b3: number | null = null;
    let bCount = 2;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        b3 = draw();
        bCount = 3;
      }
    }

    if (pendingBet !== null) {
      const finalBT = b3 !== null ? (b1 + b2 + b3) % 10 : bT;
      const finalPT = p3 !== null ? (p1 + p2 + p3) % 10 : pT;
      const hit = bCount === 2 && finalBT === 6 && finalBT > finalPT;
      pendingBet.nextResult = { hit, payout: hit ? 22 : 0 };
      bettableHands.push(pendingBet);
      pendingBet = null;
    }

    const arr = new Array(10).fill(0);
    for (let i = pos; i < shoe.length; i++) arr[shoe[i]]++;
    if (remaining() >= 104) {
      const ev = calcLucky6TwoEV(arr);
      if (ev !== null && ev > THRESHOLD) {
        bettable++;
        pendingBet = { hand: actualHands, edge: parseFloat((-ev * 100).toFixed(4)) };
      }
    }
  }

  if (pendingBet !== null) {
    pendingBet.nextResult = { hit: false, payout: 0, noNextHand: true };
    bettableHands.push(pendingBet);
    pendingBet = null;
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

  const finalArr = new Array(10).fill(0);
  for (let v = 0; v <= 9; v++) finalArr[v] = deck[v];
  const l6Final = makeBet((h: any) => h.bCount === 2 && h.bTotal === 6 && h.winner === 'banker', 22);
  enumerate(finalArr, [l6Final]);
  const finalR = l6Final.result();

  return { deck, bettable, actualHands, bettableHands, prob: finalR.prob, ev: finalR.ev };
}

function simulateDragonBonus(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  let bettablePlayer = 0, bettableBanker = 0;
  let actualHands = 0;
  const bettableHandsPlayer: any[] = [];
  const bettableHandsBanker: any[] = [];
  let pendingPlayer: any = null, pendingBanker: any = null;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null, b3: number | null = null;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        b3 = draw();
      }
    }

    const finalPT = p3 !== null ? (p1 + p2 + p3) % 10 : pT;
    const finalBT = b3 !== null ? (b1 + b2 + b3) % 10 : bT;
    const pCards = p3 !== null ? [p1, p2, p3] : [p1, p2];
    const bCards = b3 !== null ? [b1, b2, b3] : [b1, b2];
    const naturalP = (p1 + p2) % 10 >= 8;
    const naturalB = (b1 + b2) % 10 >= 8;
    const winner = finalPT > finalBT ? 'player' : finalBT > finalPT ? 'banker' : 'tie';

    if (pendingPlayer !== null) {
      let hit = false, payout = 0;
      if (winner === 'player') {
        if (naturalP) { hit = true; payout = 1; }
        else {
          const diff = finalPT - finalBT;
          if (diff === 9) { hit = true; payout = 30; }
          else if (diff === 8) { hit = true; payout = 10; }
          else if (diff === 7) { hit = true; payout = 5; }
          else if (diff === 6) { hit = true; payout = 3; }
          else if (diff === 5) { hit = true; payout = 2; }
          else if (diff === 4) { hit = true; payout = 1; }
        }
      }
      pendingPlayer.nextResult = { hit, payout, cardCount: pCards.length + bCards.length };
      bettableHandsPlayer.push(pendingPlayer);
      pendingPlayer = null;
    }

    if (pendingBanker !== null) {
      let hit = false, payout = 0;
      if (winner === 'banker') {
        if (naturalB) { hit = true; payout = 1; }
        else {
          const diff = finalBT - finalPT;
          if (diff === 9) { hit = true; payout = 30; }
          else if (diff === 8) { hit = true; payout = 10; }
          else if (diff === 7) { hit = true; payout = 5; }
          else if (diff === 6) { hit = true; payout = 3; }
          else if (diff === 5) { hit = true; payout = 2; }
          else if (diff === 4) { hit = true; payout = 1; }
        }
      }
      pendingBanker.nextResult = { hit, payout, cardCount: pCards.length + bCards.length };
      bettableHandsBanker.push(pendingBanker);
      pendingBanker = null;
    }

    const arr = new Array(10).fill(0);
    for (let i = pos; i < shoe.length; i++) arr[shoe[i]]++;
    if (remaining() >= 104) {
      const dragonEV = calcDragonEV({ ...arr });
      if (dragonEV) {
        if (dragonEV.player > THRESHOLD) {
          bettablePlayer++;
          pendingPlayer = { hand: actualHands, edge: parseFloat((-dragonEV.player * 100).toFixed(4)) };
        }
        if (dragonEV.banker > THRESHOLD) {
          bettableBanker++;
          pendingBanker = { hand: actualHands, edge: parseFloat((-dragonEV.banker * 100).toFixed(4)) };
        }
      }
    }
  }

  if (pendingPlayer !== null) {
    pendingPlayer.nextResult = { hit: false, payout: 0, noNextHand: true };
    bettableHandsPlayer.push(pendingPlayer);
    pendingPlayer = null;
  }
  if (pendingBanker !== null) {
    pendingBanker.nextResult = { hit: false, payout: 0, noNextHand: true };
    bettableHandsBanker.push(pendingBanker);
    pendingBanker = null;
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

  const finalEV = calcDragonEV(deck) || { player: null, banker: null };

  return {
    deck, actualHands,
    bettablePlayer, bettableBanker,
    bettableHandsPlayer, bettableHandsBanker,
    playerEV: finalEV.player,
    bankerEV: finalEV.banker,
  };
}

function simulateLucky6Combo(hands: number): any {
  const shoe: number[] = [];
  for (let v = 0; v <= 9; v++) {
    const cnt = v === 0 ? 128 : 32;
    for (let i = 0; i < cnt; i++) shoe.push(v);
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  let pos = 0;
  function draw(): number { return shoe[pos++]; }
  function remaining(): number { return shoe.length - pos; }

  const THRESHOLD = -0.005;
  let bettableTwo = 0, bettableThree = 0;
  let actualHands = 0;
  const bettableHands: any[] = [];
  let pendingBet: any = null;

  for (let h = 0; h < hands; h++) {
    if (remaining() < 6) break;
    actualHands++;

    const p1 = draw(), b1 = draw(), p2 = draw(), b2 = draw();
    const pT = (p1 + p2) % 10;
    const bT = (b1 + b2) % 10;

    let p3: number | null = null, b3: number | null = null;
    let bCount = 2;
    if (pT < 8 && bT < 8) {
      if (pT <= 5) {
        if (remaining() < 1) break;
        p3 = draw();
      }
      let bankerDraw = false;
      if (p3 === null) {
        bankerDraw = bT <= 5;
      } else {
        switch (bT) {
          case 0: case 1: case 2: bankerDraw = true; break;
          case 3: bankerDraw = p3 !== 8; break;
          case 4: bankerDraw = p3 >= 2 && p3 <= 7; break;
          case 5: bankerDraw = p3 >= 4 && p3 <= 7; break;
          case 6: bankerDraw = p3 === 6 || p3 === 7; break;
          case 7: bankerDraw = false; break;
        }
      }
      if (bankerDraw) {
        if (remaining() < 1) break;
        b3 = draw();
        bCount = 3;
      }
    }

    if (pendingBet !== null) {
      const finalBT = b3 !== null ? (b1 + b2 + b3) % 10 : bT;
      const finalPT = p3 !== null ? (p1 + p2 + p3) % 10 : pT;
      const hitTwo   = bCount === 2 && finalBT === 6 && finalBT > finalPT;
      const hitThree = bCount === 3 && finalBT === 6 && finalBT > finalPT;
      pendingBet.nextResult = { hitTwo, hitThree, payoutTwo: 22, payoutThree: 50 };
      bettableHands.push(pendingBet);
      pendingBet = null;
    }

    const arr = new Array(10).fill(0);
    for (let i = pos; i < shoe.length; i++) arr[shoe[i]]++;
    if (remaining() >= 104) {
      const evTwo   = calcLucky6TwoEV(arr);
      const evThree = calcLucky6ThreeEV(arr);
      const betTwo   = evTwo   !== null && evTwo   > THRESHOLD;
      const betThree = evThree !== null && evThree > THRESHOLD;
      if (betTwo) bettableTwo++;
      if (betThree) bettableThree++;
      if (betTwo || betThree) {
        pendingBet = {
          hand: actualHands,
          betTwo,
          betThree,
          edgeTwo:   betTwo   ? parseFloat((-evTwo!   * 100).toFixed(4)) : 0,
          edgeThree: betThree ? parseFloat((-evThree! * 100).toFixed(4)) : 0,
        };
      }
    }
  }

  if (pendingBet !== null) {
    pendingBet.nextResult = { hitTwo: false, hitThree: false, payoutTwo: 22, payoutThree: 50, noNextHand: true };
    bettableHands.push(pendingBet);
    pendingBet = null;
  }

  const deck: Record<number, number> = {};
  for (let v = 0; v <= 9; v++) deck[v] = 0;
  for (let i = pos; i < shoe.length; i++) deck[shoe[i]]++;

  return { deck, actualHands, bettableTwo, bettableThree, bettableHands };
}

// ── Session 管理 ──────────────────────────────────────────────

interface Session {
  deck: Record<number, number>;
  history: number[];
  cachedResult: any;
}

@Injectable()
export class BaccaratService implements OnModuleInit {
  private sessions = new Map<string, Session>();
  private FRESH_DECK_RESULT: any;

  onModuleInit() {
    console.log('预计算新牌靴概率...');
    this.FRESH_DECK_RESULT = calculateProbability(initDeck());
    console.log('预计算完成，超级闲幸运七期望值:', this.FRESH_DECK_RESULT.ev.toFixed(4));
  }

  getOrCreateSession(id: string | null): { id: string; session: Session } {
    if (!id || !this.sessions.has(id)) {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      this.sessions.set(newId, {
        deck: initDeck(),
        history: [],
        cachedResult: this.FRESH_DECK_RESULT,
      });
      return { id: newId, session: this.sessions.get(newId)! };
    }
    return { id, session: this.sessions.get(id)! };
  }

  private getResult(session: Session): any {
    if (!session.cachedResult) {
      session.cachedResult = calculateProbability(session.deck);
    }
    return session.cachedResult;
  }

  private invalidateCache(session: Session): void {
    session.cachedResult = null;
  }

  calc(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    const result = this.getResult(session);
    return { id, data: { deck: session.deck, result, historyCount: session.history.length } };
  }

  remove(sessionId: string | null, cards: number[]): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    const removed: number[] = [];
    const failed: any[] = [];

    for (const v of cards) {
      const val = parseInt(String(v), 10);
      if (isNaN(val) || val < 0 || val > 9 || !session.deck[val]) {
        failed.push(v);
      } else {
        session.deck[val]--;
        removed.push(val);
        session.history.push(val);
      }
    }

    if (removed.length > 0) this.invalidateCache(session);
    const result = this.getResult(session);
    return {
      id,
      data: {
        removed,
        failed,
        deck: session.deck,
        result,
        historyCount: session.history.length,
      },
    };
  }

  reset(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    session.deck = initDeck();
    session.history = [];
    session.cachedResult = this.FRESH_DECK_RESULT;
    return {
      id,
      data: { deck: session.deck, result: this.FRESH_DECK_RESULT, historyCount: 0 },
    };
  }

  status(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    return {
      id,
      data: {
        deck: session.deck,
        remaining: totalCards(session.deck),
        historyCount: session.history.length,
      },
    };
  }

  dragonImpact(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    const impact = calcCardImpact(session.deck);
    return { id, data: { impact } };
  }

  lucky6Impact(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    const impact = calcLucky6Impact(session.deck);
    return { id, data: { impact } };
  }

  s7Impact(sessionId: string | null): { id: string; data: any } {
    const { id, session } = this.getOrCreateSession(sessionId);
    const impact = calcSuperSevenImpact(session.deck);
    return { id, data: { impact } };
  }

  simulate(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    const { deck, bettable, actualHands } = simulateDealing(h);
    const result = calculateProbability(deck);
    return { hands: h, actualHands, deck, result, bettable };
  }

  simulateS7(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    const { deck, bettable, actualHands, bettableHands, prob, ev } = simulateSuperSeven(h);
    return { hands: h, actualHands, deck, bettable, bettableHands, prob, ev };
  }

  simulateDragon(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    return simulateDragonBonus(h);
  }

  simulateL6Two(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    const { deck, bettable, actualHands, bettableHands, prob, ev } = simulateLucky6Two(h);
    return { hands: h, actualHands, deck, bettable, bettableHands, prob, ev };
  }

  simulateL6Three(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    const { deck, bettable, actualHands, bettableHands, prob, ev } = simulateLucky6Three(h);
    return { hands: h, actualHands, deck, bettable, bettableHands, prob, ev };
  }

  simulateL6Combo(hands: number): any {
    const h = Math.max(1, Math.min(10000, hands || 100));
    return simulateLucky6Combo(h);
  }
}
