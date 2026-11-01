// Pure validation shared by the poll endpoints and the test suite.
export function validatePoll(input) {
  const question = typeof input?.question === 'string' ? input.question.trim() : '';
  const options = input?.options;
  if (!question || question.length > 240) {
    throw new Error('اكتب سؤال الاستفتاء بما لا يزيد عن ٢٤٠ حرفًا.');
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    throw new Error('الاستفتاء يحتاج من خيارين إلى عشرة خيارات.');
  }
  if (!options.every(option => typeof option === 'string' && option.trim().length > 0 && option.trim().length <= 120)) {
    throw new Error('تأكد من كتابة جميع الخيارات (١٢٠ حرفًا كحد أقصى للخيار).');
  }
  const normalized = options.map(option => option.trim());
  if (new Set(normalized.map(option => option.toLocaleLowerCase())).size !== normalized.length) {
    throw new Error('لا يمكن تكرار نفس الخيار في الاستفتاء.');
  }
  return { question, options: normalized };
}

export function validVoteIndex(index, numberOfOptions) {
  return Number.isInteger(index) && index >= 0 && index < numberOfOptions;
}
