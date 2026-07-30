import { e1Recipe } from './e1'
import { e2Recipe } from './e2'
import { e3Recipe } from './e3'
import { e4Recipe } from './e4'
import { e5Recipe } from './e5'
import { e6Recipe } from './e6'
import { p1Recipe } from './p1'
import { p2Recipe } from './p2'
import { p3Recipe } from './p3'
import { p4Recipe } from './p4'
import { p5Recipe } from './p5'
import { p6Recipe } from './p6'
import { p7Recipe } from './p7'
import { p8Recipe } from './p8'

export {
  e1Recipe,
  e2Recipe,
  e3Recipe,
  e4Recipe,
  e5Recipe,
  e6Recipe,
  p1Recipe,
  p2Recipe,
  p3Recipe,
  p4Recipe,
  p5Recipe,
  p6Recipe,
  p7Recipe,
  p8Recipe,
}

export const physicsProjectRecipes = [
  p1Recipe,
  p2Recipe,
  p3Recipe,
  p4Recipe,
  p5Recipe,
  p6Recipe,
  p7Recipe,
  p8Recipe,
]

export const environmentProjectRecipes = [
  e1Recipe,
  e2Recipe,
  e3Recipe,
  e4Recipe,
  e5Recipe,
  e6Recipe,
]

export const phase5ProjectRecipes = [
  ...physicsProjectRecipes,
  ...environmentProjectRecipes,
]
