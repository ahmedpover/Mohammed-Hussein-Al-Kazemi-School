// Pure input validators shared by routes and tests.
const invalid = message => Object.assign(new Error(message), { status: 400 });
export function validateChannelPoll(input) {
  const question = typeof input?.question === 'string' ? input.question.trim() : '';
  if (!question || question.length > 250) throw invalid('اكتب سؤال الاستفتاء، بحد أقصى 250 حرفاً.');
  if (!Array.isArray(input?.options) || input.options.length < 2 || input.options.length > 8) throw invalid('الاستفتاء يحتاج خيارين إلى 8 خيارات.');
  const options = input.options.map(v => typeof v === 'string' ? v.trim() : '');
  if (options.some(v => !v || v.length > 120) || new Set(options.map(v=>v.toLocaleLowerCase())).size !== options.length) throw invalid('خيارات الاستفتاء يجب أن تكون مختلفة وغير فارغة (حد أقصى 120 حرفاً).');
  return {question,options};
}
export function validatePollChoice(optionIndex,options) {
  if (!Array.isArray(options) || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) throw invalid('اختر إجابة صحيحة للاستفتاء.');
  return optionIndex;
}
