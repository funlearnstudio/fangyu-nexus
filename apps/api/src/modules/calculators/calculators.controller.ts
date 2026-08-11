import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { craftingRequestSchema } from "@fangyu/contracts";
import { CATALOG_ITEMS, RECIPES } from "@fangyu/domain";
import {
  calculateCraftingPlan,
  calculateSmeltingPlan,
} from "@fangyu/game-rules";
import { z } from "zod";

const smeltingSchema = z.object({
  itemCount: z.number().int().min(1).max(100000),
  recipeTicks: z.number().positive().max(100000),
  fuelBurnTicks: z.number().positive().max(1000000),
  deadlineTicks: z.number().positive().max(10000000).optional(),
});

@Controller("calculators")
export class CalculatorsController {
  @Post("crafting")
  crafting(@Body() body: unknown) {
    const parsed = craftingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return {
      data: calculateCraftingPlan({
        ...parsed.data,
        recipes: RECIPES,
        items: CATALOG_ITEMS,
      }),
      meta: {
        edition: parsed.data.edition,
        gameVersionId: parsed.data.gameVersionId,
        fixture: true,
      },
    };
  }

  @Post("smelting")
  smelting(@Body() body: unknown) {
    const parsed = smeltingSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const planInput = {
      itemCount: parsed.data.itemCount,
      recipeTicks: parsed.data.recipeTicks,
      fuelBurnTicks: parsed.data.fuelBurnTicks,
      ...(parsed.data.deadlineTicks === undefined
        ? {}
        : { deadlineTicks: parsed.data.deadlineTicks }),
    };
    return {
      data: calculateSmeltingPlan(planInput),
      meta: { fixture: true },
    };
  }
}
