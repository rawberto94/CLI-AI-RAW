
import { analyzeDocumentWithMistral } from '../lib/mistral-client';

console.log('Verifying Mistral Client Structure...');

if (typeof analyzeDocumentWithMistral === 'function') {
    console.log('✅ analyzeDocumentWithMistral function exists.');
} else {
    console.error('❌ analyzeDocumentWithMistral function missing.');
    process.exit(1);
}
