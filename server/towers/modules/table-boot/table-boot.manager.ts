import { TowersTableBootCreateInput } from "db/models";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { TableBoot } from "@/server/towers/modules/table-boot/table-boot.entity";
import { TableBootFactory } from "@/server/towers/modules/table-boot/table-boot.factory";
import { TableBootService } from "@/server/towers/modules/table-boot/table-boot.service";
import { TowersTableBootWithRelations } from "@/types/prisma";

export class TableBootManager {
  private static cache: Map<string, TableBoot> = new Map<string, TableBoot>();

  public static async findById(id: string): Promise<TableBoot | null> {
    const cached: TableBoot | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbTableBoot: TowersTableBootWithRelations | null = await TableBootService.findById(id);
    if (!dbTableBoot) return null;

    const tableBoot: TableBoot = TableBootFactory.createTableBoot(dbTableBoot);
    this.cache.set(tableBoot.id, tableBoot);

    return tableBoot;
  }

  public static async create(data: TowersTableBootCreateInput): Promise<TableBoot> {
    const dbTableBoot: TowersTableBootWithRelations = await TableBootService.create(data);

    const tableBoot: TableBoot = TableBootFactory.createTableBoot(dbTableBoot);
    this.cache.set(tableBoot.id, tableBoot);

    await PlayerManager.updateLastActiveAt(tableBoot.booterPlayerId);

    return tableBoot;
  }

  public static async delete(id: string): Promise<void> {
    await TableBootService.delete(id);
    this.cache.delete(id);
  }
}
