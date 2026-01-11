// Game enums extracted from MadronaGames.BattleNations

export const UnitSide = {
  None: 0,
  Player: 1,
  Hostile: 2,
  Neutral: 3,
  Hero: 4,
  Villain: 5,
  Test: 6,
} as const;

export const UnitSideLabels: Record<number, string> = {
  [UnitSide.None]: "None",
  [UnitSide.Player]: "Player",
  [UnitSide.Hostile]: "Hostile",
  [UnitSide.Neutral]: "Neutral",
  [UnitSide.Hero]: "Hero",
  [UnitSide.Villain]: "Villain",
  [UnitSide.Test]: "Test",
};

export const DamageType = {
  None: 0,
  Piercing: 1,
  Cold: 2,
  Crushing: 3,
  Explosive: 4,
  Fire: 5,
  Torpedo: 6,
  DepthCharge: 7,
  Melee: 8,
  Projectile: 9,
  Shell: 10,
} as const;

export const DamageTypeLabels: Record<number, string> = {
  [DamageType.None]: "None",
  [DamageType.Piercing]: "Piercing",
  [DamageType.Cold]: "Cold",
  [DamageType.Crushing]: "Crushing",
  [DamageType.Explosive]: "Explosive",
  [DamageType.Fire]: "Fire",
  [DamageType.Torpedo]: "Torpedo",
  [DamageType.DepthCharge]: "Depth Charge",
  [DamageType.Melee]: "Melee",
  [DamageType.Projectile]: "Projectile",
  [DamageType.Shell]: "Shell",
};

export const UnitBlocking = {
  None: 0,
  Partial: 1,
  Full: 2,
  God: 3,
} as const;

export const UnitBlockingLabels: Record<number, string> = {
  [UnitBlocking.None]: "None",
  [UnitBlocking.Partial]: "Partial",
  [UnitBlocking.Full]: "Full",
  [UnitBlocking.God]: "God",
};

export const WeaponType = {
  None: 0,
  Primary: 1,
  Secondary: 2,
  Special: 3,
  Melee: 4,
} as const;

export const WeaponTypeLabels: Record<number, string> = {
  [WeaponType.None]: "None",
  [WeaponType.Primary]: "Primary",
  [WeaponType.Secondary]: "Secondary",
  [WeaponType.Special]: "Special",
  [WeaponType.Melee]: "Melee",
};

export const AttackDirection = {
  None: 0,
  Front: 1,
  Back: 2,
} as const;

export const AttackDirectionLabels: Record<number, string> = {
  [AttackDirection.None]: "None",
  [AttackDirection.Front]: "Front",
  [AttackDirection.Back]: "Back",
};

export const TargetType = {
  None: 0,
  Weapon: 1,
  Target: 2,
} as const;

export const TargetTypeLabels: Record<number, string> = {
  [TargetType.None]: "None",
  [TargetType.Weapon]: "Weapon",
  [TargetType.Target]: "Target",
};

export const LayoutId = {
  None: 0,
  Equal3x3: 1,
  Equal5x3: 2,
  Equal4x3: 3,
} as const;

export const LayoutIdLabels: Record<number, string> = {
  [LayoutId.None]: "None",
  [LayoutId.Equal3x3]: "3x3",
  [LayoutId.Equal5x3]: "5x3",
  [LayoutId.Equal4x3]: "4x3",
};

export const StatusEffectType = {
  None: 0,
  Dot: 1,
  Stun: 2,
} as const;

export const StatusEffectTypeLabels: Record<number, string> = {
  [StatusEffectType.None]: "None",
  [StatusEffectType.Dot]: "DoT",
  [StatusEffectType.Stun]: "Stun",
};

export const UnitArmorDefenseStyle = {
  None: 0,
  Passive: 1,
  Active: 2,
} as const;

export const UnitArmorDefenseStyleLabels: Record<number, string> = {
  [UnitArmorDefenseStyle.None]: "None",
  [UnitArmorDefenseStyle.Passive]: "Passive",
  [UnitArmorDefenseStyle.Active]: "Active",
};

export const UnitStatusEffect = {
  None: 0,
  Stun: 1,
  Poison: 2,
  Frozen: 3,
  Plague: 4,
  Fire: 5,
  Flammable: 6,
  Breach: 7,
  Shell: 8,
  Cold: 9,
  Shatter: 10,
  Acid: 11,
  Quake: 12,
  Freeze: 13,
  Firemod: 14,
} as const;

export const UnitStatusEffectLabels: Record<number, string> = {
  [UnitStatusEffect.None]: "None",
  [UnitStatusEffect.Stun]: "Stun",
  [UnitStatusEffect.Poison]: "Poison",
  [UnitStatusEffect.Frozen]: "Frozen",
  [UnitStatusEffect.Plague]: "Plague",
  [UnitStatusEffect.Fire]: "Fire",
  [UnitStatusEffect.Flammable]: "Flammable",
  [UnitStatusEffect.Breach]: "Breach",
  [UnitStatusEffect.Shell]: "Shell",
  [UnitStatusEffect.Cold]: "Cold",
  [UnitStatusEffect.Shatter]: "Shatter",
  [UnitStatusEffect.Acid]: "Acid",
  [UnitStatusEffect.Quake]: "Quake",
  [UnitStatusEffect.Freeze]: "Freeze",
  [UnitStatusEffect.Firemod]: "Firemod",
};

export const UnitClass = {
  None: 0,
  Emplacement: 1,
  Invincible: 2,
  Critter: 3,
  Aircraft: 4,
  Sub: 5,
  Fortress: 6,
  Vehicle: 7,
  Destroyer: 8,
  HeavySoldier: 9,
  Artillery: 10,
  Battleship: 11,
  Gunboat: 12,
  Soldier: 13,
  Tank: 14,
  Ship: 15,
} as const;

export const UnitClassLabels: Record<number, string> = {
  [UnitClass.None]: "None",
  [UnitClass.Emplacement]: "Emplacement",
  [UnitClass.Invincible]: "Invincible",
  [UnitClass.Critter]: "Critter",
  [UnitClass.Aircraft]: "Aircraft",
  [UnitClass.Sub]: "Sub",
  [UnitClass.Fortress]: "Fortress",
  [UnitClass.Vehicle]: "Vehicle",
  [UnitClass.Destroyer]: "Destroyer",
  [UnitClass.HeavySoldier]: "Heavy Soldier",
  [UnitClass.Artillery]: "Artillery",
  [UnitClass.Battleship]: "Battleship",
  [UnitClass.Gunboat]: "Gunboat",
  [UnitClass.Soldier]: "Soldier",
  [UnitClass.Tank]: "Tank",
  [UnitClass.Ship]: "Ship",
};

export const UnitTag = {
  None: 0,
  SeaDefense: 1,
  Legend: 2,
  Artillery: 3,
  Bigfoot: 4,
  Vrb: 5,
  Soldier: 6,
  MechArtillery: 7,
  Sub: 8,
  Lta: 9,
  Ani: 10,
  Vehicle: 11,
  Hunter: 12,
  Submersible: 13,
  Ancient: 14,
  Sea: 15,
  Srb: 16,
  Battleship: 17,
  Defense: 18,
  Sol: 19,
  Tank: 20,
  Sealife: 21,
  Grouper: 22,
  Helicopter: 23,
  Ground: 24,
  FlyingCritter: 25,
  Metal: 26,
  Ignorable: 27,
  Crossover2: 28,
  Ship: 29,
  I17Ancient: 30,
  Wimp: 31,
  Fast: 32,
  Zombie: 33,
  Spiderwasp: 34,
  Inf: 35,
  Fighter: 36,
  Destroyer: 37,
  Critter: 38,
  Air: 39,
  Unicorn: 40,
  Civilian: 41,
  ZombieCandidate: 42,
  Airc: 43,
  Veh: 44,
  MissileStrike: 45,
  Sniper: 46,
  Gunboat: 47,
  Crossover: 48,
  Hospital: 49,
  Personnel: 50,
  Unit: 51,
  Aircraft: 52,
  Drone: 53,
  Bomber: 54,
  Structure: 55,
  SeaStructure: 56,
  NonCom: 57,
  Wall: 58,
  SeaWall: 59,
  Armored: 60,
  Biological: 61,
  Elite: 62,
  Immobile: 63,
  Mechanical: 64,
  Raider: 65,
  Slow: 66,
  Stealth: 67,
  UsesCover: 68,
} as const;

export const UnitTagLabels: Record<number, string> = {
  [UnitTag.None]: "None",
  [UnitTag.SeaDefense]: "Sea Defense",
  [UnitTag.Legend]: "Legend",
  [UnitTag.Artillery]: "Artillery",
  [UnitTag.Bigfoot]: "Bigfoot",
  [UnitTag.Vrb]: "VRB",
  [UnitTag.Soldier]: "Soldier",
  [UnitTag.MechArtillery]: "Mech Artillery",
  [UnitTag.Sub]: "Sub",
  [UnitTag.Lta]: "LTA",
  [UnitTag.Ani]: "Animal",
  [UnitTag.Vehicle]: "Vehicle",
  [UnitTag.Hunter]: "Hunter",
  [UnitTag.Submersible]: "Submersible",
  [UnitTag.Ancient]: "Ancient",
  [UnitTag.Sea]: "Sea",
  [UnitTag.Srb]: "SRB",
  [UnitTag.Battleship]: "Battleship",
  [UnitTag.Defense]: "Defense",
  [UnitTag.Sol]: "Sol",
  [UnitTag.Tank]: "Tank",
  [UnitTag.Sealife]: "Sealife",
  [UnitTag.Grouper]: "Grouper",
  [UnitTag.Helicopter]: "Helicopter",
  [UnitTag.Ground]: "Ground",
  [UnitTag.FlyingCritter]: "Flying Critter",
  [UnitTag.Metal]: "Metal",
  [UnitTag.Ignorable]: "Ignorable",
  [UnitTag.Crossover2]: "Crossover 2",
  [UnitTag.Ship]: "Ship",
  [UnitTag.I17Ancient]: "I17 Ancient",
  [UnitTag.Wimp]: "Wimp",
  [UnitTag.Fast]: "Fast",
  [UnitTag.Zombie]: "Zombie",
  [UnitTag.Spiderwasp]: "Spiderwasp",
  [UnitTag.Inf]: "Infantry",
  [UnitTag.Fighter]: "Fighter",
  [UnitTag.Destroyer]: "Destroyer",
  [UnitTag.Critter]: "Critter",
  [UnitTag.Air]: "Air",
  [UnitTag.Unicorn]: "Unicorn",
  [UnitTag.Civilian]: "Civilian",
  [UnitTag.ZombieCandidate]: "Zombie Candidate",
  [UnitTag.Airc]: "Airc",
  [UnitTag.Veh]: "Veh",
  [UnitTag.MissileStrike]: "Missile Strike",
  [UnitTag.Sniper]: "Sniper",
  [UnitTag.Gunboat]: "Gunboat",
  [UnitTag.Crossover]: "Crossover",
  [UnitTag.Hospital]: "Hospital",
  [UnitTag.Personnel]: "Personnel",
  [UnitTag.Unit]: "Unit",
  [UnitTag.Aircraft]: "Aircraft",
  [UnitTag.Drone]: "Drone",
  [UnitTag.Bomber]: "Bomber",
  [UnitTag.Structure]: "Structure",
  [UnitTag.SeaStructure]: "Sea Structure",
  [UnitTag.NonCom]: "Non-Com",
  [UnitTag.Wall]: "Wall",
  [UnitTag.SeaWall]: "Sea Wall",
  [UnitTag.Armored]: "Armored",
  [UnitTag.Biological]: "Biological",
  [UnitTag.Elite]: "Elite",
  [UnitTag.Immobile]: "Immobile",
  [UnitTag.Mechanical]: "Mechanical",
  [UnitTag.Raider]: "Raider",
  [UnitTag.Slow]: "Slow",
  [UnitTag.Stealth]: "Stealth",
  [UnitTag.UsesCover]: "Uses Cover",
};

// Proto namespace enums (different from main game enums)
export const ProtoWeaponType = {
  None: 0,
  Primary: 1,
  Secondary: 2,
  Special: 3,
  Melee: 4,
} as const;

export const ProtoWeaponTypeLabels: Record<number, string> = {
  [ProtoWeaponType.None]: "None",
  [ProtoWeaponType.Primary]: "Primary",
  [ProtoWeaponType.Secondary]: "Secondary",
  [ProtoWeaponType.Special]: "Special",
  [ProtoWeaponType.Melee]: "Melee",
};

export const ProtoDamageType = {
  StandardDamage: 0,
  CriticalDamage: 1,
  SecondaryDamage: 2,
  DodgeDamage: 3,
  MissDamage: 4,
  ImmuneDamage: 5,
  TargetedDamage: 6,
  DotstatusDamage: 7,
} as const;

export const ProtoDamageTypeLabels: Record<number, string> = {
  [ProtoDamageType.StandardDamage]: "Standard",
  [ProtoDamageType.CriticalDamage]: "Critical",
  [ProtoDamageType.SecondaryDamage]: "Secondary",
  [ProtoDamageType.DodgeDamage]: "Dodge",
  [ProtoDamageType.MissDamage]: "Miss",
  [ProtoDamageType.ImmuneDamage]: "Immune",
  [ProtoDamageType.TargetedDamage]: "Targeted",
  [ProtoDamageType.DotstatusDamage]: "DoT Status",
};

// Type exports for TypeScript
export type UnitSideType = typeof UnitSide[keyof typeof UnitSide];
export type DamageTypeType = typeof DamageType[keyof typeof DamageType];
export type UnitBlockingType = typeof UnitBlocking[keyof typeof UnitBlocking];
export type WeaponTypeType = typeof WeaponType[keyof typeof WeaponType];
export type AttackDirectionType = typeof AttackDirection[keyof typeof AttackDirection];
export type TargetTypeType = typeof TargetType[keyof typeof TargetType];
export type LayoutIdType = typeof LayoutId[keyof typeof LayoutId];
export type StatusEffectTypeType = typeof StatusEffectType[keyof typeof StatusEffectType];
export type UnitArmorDefenseStyleType = typeof UnitArmorDefenseStyle[keyof typeof UnitArmorDefenseStyle];
export type UnitStatusEffectType = typeof UnitStatusEffect[keyof typeof UnitStatusEffect];
export type UnitClassType = typeof UnitClass[keyof typeof UnitClass];
export type UnitTagType = typeof UnitTag[keyof typeof UnitTag];
export type ProtoWeaponTypeType = typeof ProtoWeaponType[keyof typeof ProtoWeaponType];
export type ProtoDamageTypeType = typeof ProtoDamageType[keyof typeof ProtoDamageType];
