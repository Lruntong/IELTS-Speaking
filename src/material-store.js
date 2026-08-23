function normalizeList(materials) {
  return Array.isArray(materials) ? [...materials] : [];
}

function normalizeTimestamp(value) {
  const parsed = new Date(value ?? Date.now());
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeTags(tags) {
  return Array.isArray(tags)
    ? [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8)
    : [];
}

function findExistingBinding(materials, predicate) {
  return normalizeList(materials).find(predicate) || null;
}

export function parseStoredMaterials(rawValue, reportError = console.error) {
  if (rawValue == null || String(rawValue).trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      throw new TypeError('Material storage must contain an array.');
    }
    return parsed.filter((material) => material?.id && material?.title && material?.story);
  } catch (error) {
    reportError('Recoverable material storage error; using empty state.', error);
    return [];
  }
}

function upsertBoundMaterial(materials, input, binding) {
  const list = normalizeList(materials);
  const existing = findExistingBinding(
    list,
    (material) =>
      material?.id === input?.id
      || (material?.type === binding.type && material?.[binding.key] === input?.[binding.key])
  );
  const createdAt = normalizeTimestamp(input?.createdAt ?? existing?.createdAt);
  const nextMaterial = {
    ...existing,
    ...input,
    type: binding.type,
    [binding.key]: input?.[binding.key] ?? existing?.[binding.key] ?? null,
    title: String(input?.title ?? existing?.title ?? '').trim(),
    story: String(input?.story ?? existing?.story ?? '').trim(),
    tags: normalizeTags(input?.tags ?? existing?.tags),
    createdAt,
    updatedAt: normalizeTimestamp(input?.updatedAt),
  };

  if (binding.type === 'question-specific') {
    nextMaterial.seasonId = String(
      input?.seasonId ?? input?.season ?? existing?.seasonId ?? existing?.season ?? ''
    ).trim();
  }

  return [
    nextMaterial,
    ...list.filter(
      (material) =>
        material?.id !== nextMaterial.id
        && !(material?.type === binding.type && material?.[binding.key] === nextMaterial[binding.key])
    ),
  ];
}

export function getCoreMaterial(materials, motherId) {
  return findExistingBinding(
    materials,
    (material) => material?.type === 'mother-core' && material?.motherId === motherId
  );
}

export function getQuestionMaterial(materials, questionId) {
  return findExistingBinding(
    materials,
    (material) => material?.type === 'question-specific' && material?.questionId === questionId
  );
}

export function upsertCoreMaterial(materials, input) {
  return upsertBoundMaterial(materials, input, {
    type: 'mother-core',
    key: 'motherId',
  });
}

export function upsertQuestionMaterial(materials, input) {
  return upsertBoundMaterial(materials, input, {
    type: 'question-specific',
    key: 'questionId',
  });
}

export function resolveMaterialForQuestion(materials, question) {
  if (!question?.id) {
    return null;
  }

  if (question.motherId) {
    const material = getCoreMaterial(materials, question.motherId);
    return material ? { material, bindingType: 'mother-core' } : null;
  }

  const material = getQuestionMaterial(materials, question.id);
  return material ? { material, bindingType: 'question-specific' } : null;
}

export function pickPracticeMaterial(materials, options = {}) {
  const list = normalizeList(materials);
  const practiceQuestion = options.practiceQuestion || null;
  const selectedMaterialId = options.selectedMaterialId || '';

  if (practiceQuestion) {
    return resolveMaterialForQuestion(list, practiceQuestion)?.material || null;
  }

  return list.find((material) => material?.id === selectedMaterialId) || null;
}

export function shouldInvalidatePracticeForMaterialChange(activeMaterial, editedMaterialId, editedBinding) {
  if (!activeMaterial) return false;
  if (editedMaterialId && activeMaterial.id === editedMaterialId) return true;
  if (editedBinding?.type === 'mother-core') {
    return activeMaterial.type === 'mother-core' && activeMaterial.motherId === editedBinding.motherId;
  }
  if (editedBinding?.type === 'question-specific') {
    return activeMaterial.type === 'question-specific' && activeMaterial.questionId === editedBinding.questionId;
  }
  return false;
}
