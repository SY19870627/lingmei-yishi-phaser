import Ajv from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import sacredItemSchema from '../../schemas/sacred-item.schema.json' assert { type: 'json' };
import wordcardSchema from '../../schemas/wordcard.schema.json' assert { type: 'json' };
import npcSchema from '../../schemas/npc.schema.json' assert { type: 'json' };
import spiritSchema from '../../schemas/spirit.schema.json' assert { type: 'json' };
import anchorSchema from '../../schemas/anchor.schema.json' assert { type: 'json' };
import storySchema from '../../schemas/story.schema.json' assert { type: 'json' };

type SchemaName =
  | 'sacred-item'
  | 'wordcard'
  | 'npc'
  | 'spirit'
  | 'anchor'
  | 'story';

const SCHEMAS: Record<SchemaName, unknown> = {
  'sacred-item': sacredItemSchema,
  'wordcard': wordcardSchema,
  'npc': npcSchema,
  'spirit': spiritSchema,
  'anchor': anchorSchema,
  'story': storySchema,
};

export class DataValidator {
  private readonly ajv: Ajv;
  private readonly validators: Map<SchemaName, ValidateFunction>;

  constructor(){
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.validators = new Map();

    for (const [name, schema] of Object.entries(SCHEMAS) as [SchemaName, unknown][]){
      this.validators.set(name, this.ajv.compile(schema));
    }
  }

  validate(name: SchemaName, data: unknown): { ok: boolean; errors?: string[] } {
    const validator = this.validators.get(name);
    if (!validator){
      return { ok: false, errors: [`Unknown schema: ${name}`] };
    }
    const valid = validator(data);
    if (valid){
      return { ok: true };
    }
    const errors = (validator.errors ?? []) as ErrorObject[];
    const messages = errors.length > 0
      ? errors.map((err) => this.ajv.errorsText([err], { dataVar: name }))
      : ['Unknown validation error'];
    return { ok: false, errors: messages };
  }
}
