from pathlib import Path

path = Path('workflow-schema.js')
text = path.read_text()
marker = "  'CHAIN':Object.freeze("
if text.count(marker) != 1:
    raise SystemExit(f'confirmation type insertion marker mismatch: {text.count(marker)}')
boolean_type = "Object.freeze({valueType:'BOOLEAN',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})"
integer_type = "Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})"
entry = (
    "  'CONFIRMATION':Object.freeze({"
    f"ZERO_MATERIAL_CHANGES:{boolean_type},"
    f"TEN_NEW_CONTEXTS:{boolean_type},"
    f"COMPLETE_TEST_RESULTS:{boolean_type},"
    f"REGRESSION_RESULTS:{boolean_type},"
    f"COMPARISON_RESULTS:{boolean_type},"
    f"NEW_DEFECTS:{integer_type},"
    f"NEW_REQUIREMENTS:{integer_type},"
    f"NEW_FAILURE_CASES:{integer_type},"
    f"NEW_VARIANCE:{integer_type}"
    "}),\n"
)
path.write_text(text.replace(marker, entry + marker, 1))
