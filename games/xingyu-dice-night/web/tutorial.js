export const lessons = [
  ['掷出手里的骰子','每人起手有七颗小骰、一颗大骰和两枚筹码。轮到你时，点「掷骰」一次掷出所有剩余骰。两人桌每轮开始时还会投放八颗中立骰，它们独立占场。'],
  ['挑一个点数，整组落下','例如掷出三个 4，点亮起的 4 号场地，三个 4 会一起放上去。其余骰子留在手中，下次轮到你时重新掷。'],
  ['什么时候用筹码','只在掷骰后、落骰前可以点「跳过」。花一枚筹码，保留手中全部骰子，把机会让给下一位还有骰子的玩家。'],
  ['六个场地怎么分奖','每场亮两张奖金牌。大骰算 2，同实力的阵营一起退出这个场地的排名。剩下前两名依次拿大牌、小牌；中立与灰骰赢的牌、无人领取的牌都归堆。'],
  ['打完三轮看总分','前两轮结束后由房主继续。收回手骰、重发奖金，每人再领两枚筹码。第三轮把奖金牌与剩余筹码相加，每枚值 1 万；同分再比牌张数加筹码数，仍相同则共享胜利。'],
  ['可选扩展 · F1 灰骰板','联机房主可在开局前拼上 F1。把自己的骰组放到这块板的场地后，若还有灰骰，选一整组，再点任意目标场地。灰骰是另一独立阵营，放灰骰不会再次触发板。']
];

export function guidedHint(view) {
  const {state:s,you}=view, g=s.game;
  if(s.phase==='lobby')return '先点准备。全员入座准备后，房主开局。';
  if(s.phase==='complete')return '打开终局记分，查看三轮奖金与剩余筹码的折算。';
  if(s.phase==='between')return '点「查看分账」看六场奖金去向。房主点下一轮后重新发牌与取骰。';
  if(g.actor!==you)return '观察'+s.players[g.actor].name+'的选择。轮到你时，桌边会亮起操作。';
  if(s.phase==='roll')return '点「掷骰」投出手中全部 '+g.remaining[you]+' 颗骰子。';
  if(s.phase==='gray')return '触发 F1！选一组灰骰，再点任意场地，一整组都会移过去。';
  const counts=Array(7).fill(0);
  for(const d of g.roll)counts[d.face]++;
  const count=Math.max(...counts),face=counts.indexOf(count);
  return '例如点 '+face+' 号，'+count+' 颗 '+face+' 点骰会一起放下。'+(g.chips[you]?'也可花 1 筹码跳过。':'筹码已用完。');
}
