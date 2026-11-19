// Card IDs distinguish physically separate cards of the same value.
const values = [11,11,13,15,13,11,9,7].flatMap((count, i) => Array(count).fill((i+3)*10000));
export const cardValue = id => values[id];
export const orderedDeck = () => values.map((_, id) => id);

export function shuffledDeck(randomIndex) {
  const deck = orderedDeck();
  for (let last = deck.length-1; last>0; last--) {
    const index = randomIndex(last+1);
    [deck[last],deck[index]] = [deck[index],deck[last]];
  }
  return deck;
}

export function dealPrizes(deck) {
  const pairs = Array.from({length:6},()=>deck.splice(0,2).sort((a,b)=>cardValue(b)-cardValue(a)));
  const sum = pair => cardValue(pair[0])+cardValue(pair[1]);
  return pairs.sort((a,b)=>sum(a)-sum(b) || cardValue(a[0])-cardValue(b[0]));
}

export function strengths(dice) {
  const counts = new Map();
  for (const die of dice) counts.set(die.owner,(counts.get(die.owner)||0)+(die.big?2:1));
  const entries = [...counts].map(([owner,strength])=>({owner,strength}));
  return entries.map(row=>({...row,tied:entries.some(other=>other.owner!==row.owner && other.strength===row.strength)}))
    .sort((a,b)=>b.strength-a.strength);
}

export function settleRound(game) {
  const venues = game.venues.map((dice,index)=>{
    const ranks = strengths(dice);
    const eligible = ranks.filter(row=>!row.tied);
    const awards = game.prizes[index].map((card,i)=>{
      const owner = eligible[i]?.owner ?? null;
      if (Number.isInteger(owner)) game.wallets[owner].push(card);
      else game.deck.push(card);
      return {value:cardValue(card),owner};
    });
    return {ranks,awards};
  });
  // Search highest venue first. For non-playing factions, use the first payable seat.
  const next = [...venues].reverse().flatMap(v=>v.awards).find(a=>Number.isInteger(a.owner));
  const nextStarter = next?.owner ?? (game.starter+1)%game.wallets.length;
  game.history.push({round:game.round,venues,nextStarter});
}

export function finalScores(wallets,chips) {
  const rows=wallets.map((cards,seat)=>{
    const cash=cards.reduce((total,id)=>total+cardValue(id),0);
    return {seat,cash,cards:cards.length,chips:chips[seat],total:cash+chips[seat]*10000,pieces:cards.length+chips[seat]};
  }).sort((a,b)=>b.total-a.total || b.pieces-a.pieces || a.seat-b.seat);
  return rows.map(row=>({...row,winner:row.total===rows[0].total && row.pieces===rows[0].pieces}));
}
