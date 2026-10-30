import console from 'node:console'
import { validate } from './validate_design.mjs'
const state = validate()
console.log(
  JSON.stringify(
    {
      ...state,
      owner_mapping_mode: 'PENDING',
      rubric_rights_reviewers: 'PENDING',
      pilot_design: 'PROPOSED_NOT_APPROVED',
      live_experiment: 'BLOCKED_UNTIL_SEPARATE_AUTHORIZATION',
      actual_language_quality: 'NOT_EVALUATED',
      eligibility: 'DESIGN_ONLY',
      message:
        'Validation verifies offline integrity, mapping proposals and arithmetic, never translation or model behavior.',
    },
    null,
    2,
  ),
)
