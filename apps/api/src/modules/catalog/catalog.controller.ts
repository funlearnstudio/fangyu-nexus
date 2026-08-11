import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
} from "@nestjs/common";
import { editionSchema } from "@fangyu/contracts";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @Get("versions")
  versions() {
    return {
      data: this.catalog.listVersions(),
      meta: { fixture: true },
    };
  }

  @Get("items")
  items(
    @Query("edition") editionInput: string,
    @Query("version") version: string,
    @Query("q") query = "",
  ) {
    const edition = editionSchema.safeParse(editionInput);
    if (!edition.success || !version) {
      throw new BadRequestException("edition and version are required");
    }
    return {
      data: this.catalog.listItems(edition.data, version, query),
      meta: { edition: edition.data, gameVersionId: version, fixture: true },
    };
  }

  @Get("items/:slug")
  item(
    @Param("slug") slug: string,
    @Query("edition") editionInput: string,
    @Query("version") version: string,
  ) {
    const edition = editionSchema.safeParse(editionInput);
    if (!edition.success || !version) {
      throw new BadRequestException("edition and version are required");
    }
    return {
      data: this.catalog.getItem(edition.data, version, slug),
      meta: { edition: edition.data, gameVersionId: version, fixture: true },
    };
  }

  @Get("search")
  search(
    @Query("edition") editionInput: string,
    @Query("version") version: string,
    @Query("q") query = "",
  ) {
    const edition = editionSchema.safeParse(editionInput);
    if (!edition.success || !version) {
      throw new BadRequestException("edition and version are required");
    }
    return {
      data: this.catalog.search(edition.data, version, query),
      meta: { edition: edition.data, gameVersionId: version, fixture: true },
    };
  }
}
