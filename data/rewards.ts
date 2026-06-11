export type RollReward = {
  id: string;
  name: string;
  stars: number;
  chance: number;
  image: string;
};

export const rollRewards: RollReward[] = [
  { id: "makima", name: "MAKIMA", stars: 3, chance: 1, image: "/rewards/makima.png" },
  { id: "power", name: "POWER", stars: 3, chance: 4, image: "/rewards/power.png" },
  { id: "aki", name: "AKI", stars: 3, chance: 10, image: "/rewards/aki.png" },
  { id: "denji", name: "DENJI", stars: 3, chance: 20, image: "/rewards/denji.png" },
  { id: "pochita", name: "POCHITA", stars: 3, chance: 65, image: "/rewards/pochita.png" },
];

export function rollWeightedReward() {
  const totalChance = rollRewards.reduce((sum, reward) => sum + reward.chance, 0);
  let ticket = Math.random() * totalChance;

  for (const reward of rollRewards) {
    ticket -= reward.chance;
    if (ticket <= 0) return reward;
  }

  return rollRewards[rollRewards.length - 1];
}
