// Lazy import OpenAI to avoid ESM/CJS interop issues in some runners
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let OpenAICtor: any;
import Ajv from 'ajv';

const ajv = new Ajv();

export class OpenAIClient {
    private openai!: any;

    constructor(apiKey: string) {
        // Defer requiring the module until runtime
        if (!OpenAICtor) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            OpenAICtor = require('openai').OpenAI;
        }
        this.openai = new OpenAICtor({ apiKey });
    }

    async createStructured<T>(opts: {
        model: string;
        system: string;
        userChunks: any[];
        schema: any;
        temperature?: number;
    }): Promise<T> {
        // TODO: Implement the logic to call the OpenAI API with structured outputs.
        // TODO: Add validation with Ajv.
        // TODO: Implement the auto-repair loop.
        // TODO: Add logging.

    const { model, system, userChunks, schema, temperature = 0 } = opts;

    // Ensure at least one message contains the word "json" to satisfy response_format=json_object requirements
    const systemWithJson = `${system} Return a valid JSON object that strictly matches the provided schema. Respond with JSON only.`;
    const safetyPreamble = 'Format: json. Output must be a single JSON object.';

    const response = await this.openai.chat.completions.create({
            model,
            messages: [
        { role: 'system', content: systemWithJson },
        { role: 'user', content: safetyPreamble },
        { role: 'user', content: JSON.stringify(userChunks) },
            ],
            temperature,
            top_p: 1,
            response_format: { type: 'json_object' },
        });

        const structuredResponse = JSON.parse(response.choices[0].message.content!);

        const validate = ajv.compile(schema);
        if (!validate(structuredResponse)) {
            // TODO: Implement auto-repair logic
            console.error('Schema validation failed:', validate.errors);
            throw new Error('Schema validation failed');
        }

        return structuredResponse as T;
    }

    async chat(opts: {
        messages: Array<{ role: string; content: string }>;
        model: string;
        temperature?: number;
        max_tokens?: number;
        response_format?: { type: 'json_object' | 'text' };
    }): Promise<{ choices: Array<{ message?: { content?: string } }> }> {
        const { messages, model, temperature = 0.5, max_tokens, response_format } = opts;
        
        const response = await this.openai.chat.completions.create({
            model,
            messages: messages as any,
            temperature,
            max_tokens,
            ...(response_format && { response_format }),
        });

        return response;
    }
}
