// Exact, finite support witnesses for the named §21.4 primitives. Test-only.
// These observations do not prove every adjacent clause or an exhaustive domain.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const plain=value=>JSON.parse(JSON.stringify(value));
const sha=value=>createHash('sha256').update(value).digest('hex');
const supportPlans=[
 {
  "operation": "LOAD_ARTIFACT",
  "caseId": "named-target",
  "steps": [
   {
    "stepId": "S001",
    "op": "LOAD_ARTIFACT",
    "inputs": {
     "binding": {
      "bindingRef": "TARGET"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "READ_BYTES",
    "inputs": {
     "artifact": {
      "stepRef": "S001",
      "output": "artifact"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "DECODE_UTF8",
    "inputs": {
     "bytes": {
      "stepRef": "S002",
      "output": "bytes"
     }
    }
   },
   {
    "stepId": "S004",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S003",
      "output": "text"
     },
     "expected": {
      "literal": "selected"
     }
    }
   }
  ],
  "expectedActual": "selected",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "DECOY": {
    "bytes": [
     105,
     103,
     110,
     111,
     114,
     101,
     100
    ]
   },
   "TARGET": {
    "bytes": [
     115,
     101,
     108,
     101,
     99,
     116,
     101,
     100
    ]
   }
  }
 },
 {
  "operation": "LOAD_ARTIFACT",
  "caseId": "named-decoy",
  "steps": [
   {
    "stepId": "S001",
    "op": "LOAD_ARTIFACT",
    "inputs": {
     "binding": {
      "bindingRef": "DECOY"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "READ_BYTES",
    "inputs": {
     "artifact": {
      "stepRef": "S001",
      "output": "artifact"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "DECODE_UTF8",
    "inputs": {
     "bytes": {
      "stepRef": "S002",
      "output": "bytes"
     }
    }
   },
   {
    "stepId": "S004",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S003",
      "output": "text"
     },
     "expected": {
      "literal": "ignored"
     }
    }
   }
  ],
  "expectedActual": "ignored",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "DECOY": {
    "bytes": [
     105,
     103,
     110,
     111,
     114,
     101,
     100
    ]
   },
   "TARGET": {
    "bytes": [
     115,
     101,
     108,
     101,
     99,
     116,
     101,
     100
    ]
   }
  }
 },
 {
  "operation": "READ_BYTES",
  "caseId": "nonzero-offset-binary-view",
  "steps": [
   {
    "stepId": "S001",
    "op": "READ_BYTES",
    "inputs": {
     "artifact": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "HASH_SHA256",
    "inputs": {
     "bytes": {
      "stepRef": "S001",
      "output": "bytes"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S002",
      "output": "sha256"
     },
     "expected": {
      "literal": "a90a10503fbfc95789ff38a1bb5039cb71869ab9c0eb1cb51c4a9099f2933c6b"
     }
    }
   }
  ],
  "expectedActual": "a90a10503fbfc95789ff38a1bb5039cb71869ab9c0eb1cb51c4a9099f2933c6b",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": [
     99,
     0,
     255,
     65,
     77
    ],
    "start": 1,
    "end": 4
   }
  }
 },
 {
  "operation": "READ_BYTES",
  "caseId": "non-byte-input-refused",
  "steps": [
   {
    "stepId": "S001",
    "op": "LOAD_ARTIFACT",
    "inputs": {
     "binding": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "READ_BYTES",
    "inputs": {
     "artifact": {
      "stepRef": "S001",
      "output": "artifact"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "HASH_SHA256",
    "inputs": {
     "bytes": {
      "stepRef": "S002",
      "output": "bytes"
     }
    }
   },
   {
    "stepId": "S004",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S003",
      "output": "sha256"
     },
     "expected": {
      "literal": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
     }
    }
   }
  ],
  "expectedActual": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "expectedDetermination": "SATISFIED",
  "canonicalBindings": {
   "VALUE": {
    "value": "not bytes"
   }
  },
  "expectedError": {
   "code": "BYTES_REQUIRED",
   "disposition": "EXECUTION_FAILED"
  }
 },
 {
  "operation": "DECODE_UTF8",
  "caseId": "multibyte-and-crlf",
  "steps": [
   {
    "stepId": "S001",
    "op": "DECODE_UTF8",
    "inputs": {
     "bytes": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "text"
     },
     "expected": {
      "literal": "é🙂\r\n"
     }
    }
   }
  ],
  "expectedActual": "é🙂\r\n",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": [
     195,
     169,
     240,
     159,
     153,
     130,
     13,
     10
    ]
   }
  }
 },
 {
  "operation": "DECODE_UTF8",
  "caseId": "invalid-utf8-refused",
  "steps": [
   {
    "stepId": "S001",
    "op": "DECODE_UTF8",
    "inputs": {
     "bytes": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "text"
     },
     "expected": {
      "literal": "unreachable"
     }
    }
   }
  ],
  "expectedActual": "unreachable",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": [
     195,
     40
    ]
   }
  },
  "expectedError": {
   "code": "INVALID_UTF8",
   "disposition": "UNDETERMINED"
  }
 },
 {
  "operation": "PARSE_JSON",
  "caseId": "parsed-values-not-only-count",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_JSON",
    "inputs": {
     "text": {
      "literal": "{\"items\":[2,3],\"keep\":true}"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": {
       "items": [
        2,
        3
       ],
       "keep": true
      }
     }
    }
   }
  ],
  "expectedActual": {
   "items": [
    2,
    3
   ],
   "keep": true
  },
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "PARSE_CSV",
  "caseId": "row-arrays",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_CSV",
    "inputs": {
     "text": {
      "literal": "a,b\nc,d"
     },
     "delimiter": {
      "literal": ","
     },
     "header": {
      "literal": false
     },
     "quote": {
      "literal": "\""
     },
     "newline": {
      "literal": "LF"
     },
     "encoding": {
      "literal": "UTF-8"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       [
        "a",
        "b"
       ],
       [
        "c",
        "d"
       ]
      ]
     }
    }
   }
  ],
  "expectedActual": [
   [
    "a",
    "b"
   ],
   [
    "c",
    "d"
   ]
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "PARSE_CSV",
  "caseId": "header-objects",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_CSV",
    "inputs": {
     "text": {
      "literal": "name,count\na,2"
     },
     "delimiter": {
      "literal": ","
     },
     "header": {
      "literal": true
     },
     "quote": {
      "literal": "\""
     },
     "newline": {
      "literal": "LF"
     },
     "encoding": {
      "literal": "UTF-8"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       {
        "name": "a",
        "count": "2"
       }
      ]
     }
    }
   }
  ],
  "expectedActual": [
   {
    "name": "a",
    "count": "2"
   }
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "PARSE_XML",
  "caseId": "parsed-name-attribute-and-text",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_XML",
    "inputs": {
     "text": {
      "literal": "<root><item id=\"target\">x&amp;y</item></root>"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": {
       "name": "root",
       "attributes": {},
       "children": [
        {
         "name": "item",
         "attributes": {
          "id": "target"
         },
         "children": [],
         "content": [
          "x&y"
         ]
        }
       ],
       "content": [
        {
         "name": "item",
         "attributes": {
          "id": "target"
         },
         "children": [],
         "content": [
          "x&y"
         ]
        }
       ]
      }
     }
    }
   }
  ],
  "expectedActual": {
   "name": "root",
   "attributes": {},
   "children": [
    {
     "name": "item",
     "attributes": {
      "id": "target"
     },
     "children": [],
     "content": [
      "x&y"
     ]
    }
   ],
   "content": [
    {
     "name": "item",
     "attributes": {
      "id": "target"
     },
     "children": [],
     "content": [
      "x&y"
     ]
    }
   ]
  },
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SELECT_JSON_PATH",
  "caseId": "target-versus-equal-size-decoy",
  "steps": [
   {
    "stepId": "S001",
    "op": "SELECT_JSON_PATH",
    "inputs": {
     "value": {
      "literal": {
       "decoy": [
        9,
        9
       ],
       "target": [
        2,
        3
       ]
      }
     },
     "path": {
      "literal": "$.target"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "selection"
     },
     "expected": {
      "literal": [
       2,
       3
      ]
     }
    }
   }
  ],
  "expectedActual": [
   2,
   3
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SELECT_XML",
  "caseId": "target-text",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_XML",
    "inputs": {
     "text": {
      "literal": "<root><decoy id=\"ignore\">z</decoy><item id=\"target\">x</item><item id=\"next\">y</item></root>"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "SELECT_XML",
    "inputs": {
     "value": {
      "stepRef": "S001",
      "output": "value"
     },
     "path": {
      "literal": "/root/item/text()"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S002",
      "output": "selection"
     },
     "expected": {
      "literal": [
       "x",
       "y"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "x",
   "y"
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SELECT_XML",
  "caseId": "target-attribute",
  "steps": [
   {
    "stepId": "S001",
    "op": "PARSE_XML",
    "inputs": {
     "text": {
      "literal": "<root><decoy id=\"ignore\">z</decoy><item id=\"target\">x</item><item id=\"next\">y</item></root>"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "SELECT_XML",
    "inputs": {
     "value": {
      "stepRef": "S001",
      "output": "value"
     },
     "path": {
      "literal": "/root/item/@id"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S002",
      "output": "selection"
     },
     "expected": {
      "literal": [
       "target",
       "next"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "target",
   "next"
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COUNT",
  "caseId": "array-count",
  "steps": [
   {
    "stepId": "S001",
    "op": "COUNT",
    "inputs": {
     "value": {
      "literal": [
       9,
       -4,
       3
      ]
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "count"
     },
     "expected": {
      "literal": 3
     }
    }
   }
  ],
  "expectedActual": 3,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COUNT",
  "caseId": "utf16-string-count",
  "steps": [
   {
    "stepId": "S001",
    "op": "COUNT",
    "inputs": {
     "value": {
      "literal": "a🙂"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "count"
     },
     "expected": {
      "literal": 3
     }
    }
   }
  ],
  "expectedActual": 3,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COUNT",
  "caseId": "byte-count",
  "steps": [
   {
    "stepId": "S001",
    "op": "READ_BYTES",
    "inputs": {
     "artifact": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "COUNT",
    "inputs": {
     "value": {
      "stepRef": "S001",
      "output": "bytes"
     }
    }
   },
   {
    "stepId": "S003",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S002",
      "output": "count"
     },
     "expected": {
      "literal": 3
     }
    }
   }
  ],
  "expectedActual": 3,
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": [
     0,
     255,
     65
    ]
   }
  }
 },
 {
  "operation": "SUM",
  "caseId": "mixed-sign-sum",
  "steps": [
   {
    "stepId": "S001",
    "op": "SUM",
    "inputs": {
     "value": {
      "literal": [
       9,
       -4,
       3
      ]
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": 8
     }
    }
   }
  ],
  "expectedActual": 8,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SUM",
  "caseId": "empty-sum",
  "steps": [
   {
    "stepId": "S001",
    "op": "SUM",
    "inputs": {
     "value": {
      "literal": []
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": 0
     }
    }
   }
  ],
  "expectedActual": 0,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "MIN",
  "caseId": "interior-minimum",
  "steps": [
   {
    "stepId": "S001",
    "op": "MIN",
    "inputs": {
     "value": {
      "literal": [
       9,
       -4,
       3
      ]
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": -4
     }
    }
   }
  ],
  "expectedActual": -4,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "MAX",
  "caseId": "first-maximum",
  "steps": [
   {
    "stepId": "S001",
    "op": "MAX",
    "inputs": {
     "value": {
      "literal": [
       9,
       -4,
       3
      ]
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": 9
     }
    }
   }
  ],
  "expectedActual": 9,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SORT",
  "caseId": "string-asc",
  "steps": [
   {
    "stepId": "S001",
    "op": "SORT",
    "inputs": {
     "value": {
      "literal": [
       "b",
       "a",
       "c"
      ]
     },
     "domain": {
      "literal": "STRING"
     },
     "direction": {
      "literal": "ASC"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       "a",
       "b",
       "c"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "a",
   "b",
   "c"
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SORT",
  "caseId": "string-desc",
  "steps": [
   {
    "stepId": "S001",
    "op": "SORT",
    "inputs": {
     "value": {
      "literal": [
       "b",
       "a",
       "c"
      ]
     },
     "domain": {
      "literal": "STRING"
     },
     "direction": {
      "literal": "DESC"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       "c",
       "b",
       "a"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "c",
   "b",
   "a"
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SORT",
  "caseId": "boolean-domain",
  "steps": [
   {
    "stepId": "S001",
    "op": "SORT",
    "inputs": {
     "value": {
      "literal": [
       true,
       false,
       true
      ]
     },
     "domain": {
      "literal": "BOOLEAN"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       false,
       true,
       true
      ]
     }
    }
   }
  ],
  "expectedActual": [
   false,
   true,
   true
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SORT",
  "caseId": "integer-domain",
  "steps": [
   {
    "stepId": "S001",
    "op": "SORT",
    "inputs": {
     "value": {
      "literal": [
       9,
       -4,
       3
      ]
     },
     "domain": {
      "literal": "INTEGER"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       -4,
       3,
       9
      ]
     }
    }
   }
  ],
  "expectedActual": [
   -4,
   3,
   9
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "SORT",
  "caseId": "decimal-domain",
  "steps": [
   {
    "stepId": "S001",
    "op": "SORT",
    "inputs": {
     "value": {
      "literal": [
       {
        "numberType": "DECIMAL",
        "value": "2.0"
       },
       {
        "numberType": "DECIMAL",
        "value": "1.5"
       }
      ]
     },
     "domain": {
      "literal": "DECIMAL"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       {
        "numberType": "DECIMAL",
        "value": "1.5"
       },
       {
        "numberType": "DECIMAL",
        "value": "2.0"
       }
      ]
     }
    }
   }
  ],
  "expectedActual": [
   {
    "numberType": "DECIMAL",
    "value": "1.5"
   },
   {
    "numberType": "DECIMAL",
    "value": "2.0"
   }
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "UNIQUE",
  "caseId": "canonical-objects-array-order-and-first-occurrence",
  "steps": [
   {
    "stepId": "S001",
    "op": "UNIQUE",
    "inputs": {
     "value": {
      "literal": [
       {
        "b": 2,
        "a": 1
       },
       {
        "a": 1,
        "b": 2
       },
       [
        1,
        2
       ],
       [
        2,
        1
       ],
       [
        1,
        2
       ]
      ]
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "value"
     },
     "expected": {
      "literal": [
       {
        "b": 2,
        "a": 1
       },
       [
        1,
        2
       ],
       [
        2,
        1
       ]
      ]
     }
    }
   }
  ],
  "expectedActual": [
   {
    "b": 2,
    "a": 1
   },
   [
    1,
    2
   ],
   [
    2,
    1
   ]
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "HASH_SHA256",
  "caseId": "empty-bytes",
  "steps": [
   {
    "stepId": "S001",
    "op": "HASH_SHA256",
    "inputs": {
     "bytes": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "sha256"
     },
     "expected": {
      "literal": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
     }
    }
   }
  ],
  "expectedActual": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": []
   }
  }
 },
 {
  "operation": "HASH_SHA256",
  "caseId": "binary-bytes",
  "steps": [
   {
    "stepId": "S001",
    "op": "HASH_SHA256",
    "inputs": {
     "bytes": {
      "bindingRef": "VALUE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "sha256"
     },
     "expected": {
      "literal": "a90a10503fbfc95789ff38a1bb5039cb71869ab9c0eb1cb51c4a9099f2933c6b"
     }
    }
   }
  ],
  "expectedActual": "a90a10503fbfc95789ff38a1bb5039cb71869ab9c0eb1cb51c4a9099f2933c6b",
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "VALUE": {
    "bytes": [
     0,
     255,
     65
    ]
   }
  }
 },
 {
  "operation": "REGEX",
  "caseId": "prefix-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "REGEX",
    "inputs": {
     "value": {
      "literal": "ab"
     },
     "pattern": {
      "literal": "^a"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "match"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "REGEX",
  "caseId": "prefix-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "REGEX",
    "inputs": {
     "value": {
      "literal": "zb"
     },
     "pattern": {
      "literal": "^a"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "match"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "eq-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "EQ"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "eq-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 3
     },
     "operator": {
      "literal": "EQ"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "ne-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 3
     },
     "operator": {
      "literal": "NE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "ne-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "NE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "gt-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 3
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "GT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "gt-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "GT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "gte-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "GTE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "gte-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 1
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "GTE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "lt-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 3
     },
     "operator": {
      "literal": "LT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "lt-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "LT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "lte-true",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 2
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "LTE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "COMPARE",
  "caseId": "lte-false",
  "steps": [
   {
    "stepId": "S001",
    "op": "COMPARE",
    "inputs": {
     "left": {
      "literal": 3
     },
     "right": {
      "literal": 2
     },
     "operator": {
      "literal": "LTE"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_EQ",
  "caseId": "integer-equal",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_EQ",
  "caseId": "integer-unequal",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 3
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_EQ",
  "caseId": "canonical-object-equal",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "literal": {
       "b": 2,
       "a": 1
      }
     },
     "expected": {
      "literal": {
       "a": 1,
       "b": 2
      }
     }
    }
   }
  ],
  "expectedActual": {
   "b": 2,
   "a": 1
  },
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_EQ",
  "caseId": "canonical-object-unequal",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "literal": {
       "a": 1
      }
     },
     "expected": {
      "literal": {
       "a": 2
      }
     }
    }
   }
  ],
  "expectedActual": {
   "a": 1
  },
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_GT",
  "caseId": "satisfied",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_GT",
    "inputs": {
     "actual": {
      "literal": 3
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 3,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_GT",
  "caseId": "violated",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_GT",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_GTE",
  "caseId": "satisfied",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_GTE",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_GTE",
  "caseId": "violated",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_GTE",
    "inputs": {
     "actual": {
      "literal": 1
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 1,
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_LT",
  "caseId": "satisfied",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_LT",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 3
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_LT",
  "caseId": "violated",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_LT",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_LTE",
  "caseId": "satisfied",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_LTE",
    "inputs": {
     "actual": {
      "literal": 2
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 2,
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_LTE",
  "caseId": "violated",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_LTE",
    "inputs": {
     "actual": {
      "literal": 3
     },
     "expected": {
      "literal": 2
     }
    }
   }
  ],
  "expectedActual": 3,
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_MATCH",
  "caseId": "matches",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_MATCH",
    "inputs": {
     "actual": {
      "literal": "ab"
     },
     "pattern": {
      "literal": "^ab$"
     }
    }
   }
  ],
  "expectedActual": "ab",
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_MATCH",
  "caseId": "does-not-match",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_MATCH",
    "inputs": {
     "actual": {
      "literal": "az"
     },
     "pattern": {
      "literal": "^ab$"
     }
    }
   }
  ],
  "expectedActual": "az",
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_CONTAINS",
  "caseId": "string-present",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": "ab"
     },
     "expected": {
      "literal": "a"
     }
    }
   }
  ],
  "expectedActual": "ab",
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_CONTAINS",
  "caseId": "string-absent",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": "ab"
     },
     "expected": {
      "literal": "z"
     }
    }
   }
  ],
  "expectedActual": "ab",
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_CONTAINS",
  "caseId": "canonical-array-present",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": [
       {
        "b": 2,
        "a": 1
       }
      ]
     },
     "expected": {
      "literal": {
       "a": 1,
       "b": 2
      }
     }
    }
   }
  ],
  "expectedActual": [
   {
    "b": 2,
    "a": 1
   }
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_CONTAINS",
  "caseId": "canonical-array-absent",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": [
       {
        "a": 1
       }
      ]
     },
     "expected": {
      "literal": {
       "a": 2
      }
     }
    }
   }
  ],
  "expectedActual": [
   {
    "a": 1
   }
  ],
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_NOT_CONTAINS",
  "caseId": "string-present",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_NOT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": "ab"
     },
     "expected": {
      "literal": "a"
     }
    }
   }
  ],
  "expectedActual": "ab",
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_NOT_CONTAINS",
  "caseId": "string-absent",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_NOT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": "ab"
     },
     "expected": {
      "literal": "z"
     }
    }
   }
  ],
  "expectedActual": "ab",
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_NOT_CONTAINS",
  "caseId": "canonical-array-present",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_NOT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": [
       {
        "b": 2,
        "a": 1
       }
      ]
     },
     "expected": {
      "literal": {
       "a": 1,
       "b": 2
      }
     }
    }
   }
  ],
  "expectedActual": [
   {
    "b": 2,
    "a": 1
   }
  ],
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_NOT_CONTAINS",
  "caseId": "canonical-array-absent",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_NOT_CONTAINS",
    "inputs": {
     "actual": {
      "literal": [
       {
        "a": 1
       }
      ]
     },
     "expected": {
      "literal": {
       "a": 2
      }
     }
    }
   }
  ],
  "expectedActual": [
   {
    "a": 1
   }
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_SET_EQUAL",
  "caseId": "order-and-duplicates",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_SET_EQUAL",
    "inputs": {
     "actual": {
      "literal": [
       "a",
       "b",
       "a"
      ]
     },
     "expected": {
      "literal": [
       "b",
       "a"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "a",
   "b",
   "a"
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "ASSERT_SET_EQUAL",
  "caseId": "different-members",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_SET_EQUAL",
    "inputs": {
     "actual": {
      "literal": [
       "a",
       "b"
      ]
     },
     "expected": {
      "literal": [
       "a",
       "c"
      ]
     }
    }
   }
  ],
  "expectedActual": [
   "a",
   "b"
  ],
  "expectedDetermination": "VIOLATED"
 },
 {
  "operation": "ASSERT_SET_EQUAL",
  "caseId": "canonical-object-member",
  "steps": [
   {
    "stepId": "S001",
    "op": "ASSERT_SET_EQUAL",
    "inputs": {
     "actual": {
      "literal": [
       {
        "b": 2,
        "a": 1
       }
      ]
     },
     "expected": {
      "literal": [
       {
        "a": 1,
        "b": 2
       }
      ]
     }
    }
   }
  ],
  "expectedActual": [
   {
    "b": 2,
    "a": 1
   }
  ],
  "expectedDetermination": "SATISFIED"
 },
 {
  "operation": "BYTE_COMPARE",
  "caseId": "distinct-equal",
  "steps": [
   {
    "stepId": "S001",
    "op": "BYTE_COMPARE",
    "inputs": {
     "left": {
      "bindingRef": "LEFT"
     },
     "right": {
      "bindingRef": "RIGHT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": true
     }
    }
   }
  ],
  "expectedActual": true,
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "LEFT": {
    "bytes": [
     0,
     255,
     65
    ]
   },
   "RIGHT": {
    "bytes": [
     0,
     255,
     65
    ]
   }
  }
 },
 {
  "operation": "BYTE_COMPARE",
  "caseId": "same-length-different",
  "steps": [
   {
    "stepId": "S001",
    "op": "BYTE_COMPARE",
    "inputs": {
     "left": {
      "bindingRef": "LEFT"
     },
     "right": {
      "bindingRef": "RIGHT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "LEFT": {
    "bytes": [
     0,
     255,
     65
    ]
   },
   "RIGHT": {
    "bytes": [
     0,
     254,
     65
    ]
   }
  }
 },
 {
  "operation": "BYTE_COMPARE",
  "caseId": "different-length",
  "steps": [
   {
    "stepId": "S001",
    "op": "BYTE_COMPARE",
    "inputs": {
     "left": {
      "bindingRef": "LEFT"
     },
     "right": {
      "bindingRef": "RIGHT"
     }
    }
   },
   {
    "stepId": "S002",
    "op": "ASSERT_EQ",
    "inputs": {
     "actual": {
      "stepRef": "S001",
      "output": "comparison"
     },
     "expected": {
      "literal": false
     }
    }
   }
  ],
  "expectedActual": false,
  "expectedDetermination": "SATISFIED",
  "artifacts": {
   "LEFT": {
    "bytes": [
     0,
     255,
     65
    ]
   },
   "RIGHT": {
    "bytes": [
     0,
     255
    ]
   }
  }
 }
];
export const primitiveSupportOperations=["LOAD_ARTIFACT", "READ_BYTES", "DECODE_UTF8", "PARSE_JSON", "PARSE_CSV", "PARSE_XML", "SELECT_JSON_PATH", "SELECT_XML", "COUNT", "SUM", "MIN", "MAX", "SORT", "UNIQUE", "HASH_SHA256", "REGEX", "COMPARE", "ASSERT_EQ", "ASSERT_GT", "ASSERT_GTE", "ASSERT_LT", "ASSERT_LTE", "ASSERT_MATCH", "ASSERT_CONTAINS", "ASSERT_NOT_CONTAINS", "ASSERT_SET_EQUAL", "BYTE_COMPARE"];
export const primitiveSupportSourceInputs=['test-test-ir-primitive-support.mjs','test-runtime-operation-registry.mjs','test-runtime.js','hash.js','verifier-runtime.mjs'];
export const primitiveSupportCurrentSourceHashes=()=>Object.fromEntries(primitiveSupportSourceInputs.map(path=>[path,sha(fs.readFileSync(new URL(path,import.meta.url)))]));
export const primitiveSupportCaseOracles=supportPlans.map(p=>({operation:p.operation,caseId:p.caseId,expected:p.expectedError?{...p.expectedError}:{actual:p.expectedActual,determination:p.expectedDetermination},...(p.expectedError?{...p.expectedError}:{actual:p.expectedActual,determination:p.expectedDetermination}),result:'PASS'}));
export async function verifyPrimitiveSupportControls(runtime,runtimeSource){
 const cases=[];
 for(const p of supportPlans){
  const artifacts=Object.fromEntries(Object.entries(p.artifacts||{}).map(([name,value])=>{const bytes=new Uint8Array(value.bytes);return[name,{artifactId:'ART-SUPPORT-'+name,bytes:value.start===undefined?bytes:bytes.subarray(value.start,value.end)}];}));
  const canonicalBindings=p.canonicalBindings||{},bindings=Object.fromEntries([...Object.entries(artifacts).map(([name,a])=>[name,{kind:'ARTIFACT',artifactId:a.artifactId}]),...Object.keys(canonicalBindings).map(name=>[name,{kind:'CANONICAL_VALUE',canonicalKey:name}])]);
  const spec={version:'closed-loop-test-spec/1',languageVersion:'closed-loop-test-ir-language/1',operationRegistryVersion:'closed-loop-test-ir-operations/1',operationRegistrySha256:runtime.OPERATION_REGISTRY_SHA256,steps:p.steps,result:{stepRef:p.steps.at(-1).stepId,output:'assertion'}};
  assert(p.steps.some(step=>step.op===p.operation),'TEST_IR_SUPPORT_NAMED_OPERATION_ORACLE: '+p.caseId);
  assert.deepEqual(plain(runtime.validateSpec(spec,bindings)),{valid:true,issues:[]},'TEST_IR_SUPPORT_VALID_SPEC_ORACLE: '+p.operation+'/'+p.caseId);
  const expected=primitiveSupportCaseOracles.find(row=>row.operation===p.operation&&row.caseId===p.caseId),before=JSON.stringify({spec,canonicalBindings});
  if(p.expectedError){let failure;await assert.rejects(()=>runtime.execute({spec,artifacts,canonicalBindings,metadata:{bindings}}),error=>{failure=error;return error.code===p.expectedError.code&&error.disposition===p.expectedError.disposition;},'TEST_IR_SUPPORT_FAILURE_ORACLE: '+p.operation+'/'+p.caseId);cases.push({operation:p.operation,caseId:p.caseId,expected:{...p.expectedError},code:failure.code,disposition:failure.disposition,result:'PASS'});}
  else{
   const result=await runtime.execute({spec,artifacts,canonicalBindings,metadata:{bindings}});
   assert.equal(result.determination,p.expectedDetermination,'TEST_IR_SUPPORT_DETERMINATION_ORACLE: '+p.operation+'/'+p.caseId);
   assert.deepEqual(plain(result.actual),p.expectedActual,'TEST_IR_SUPPORT_ACTUAL_ORACLE: '+p.operation+'/'+p.caseId);
   assert.equal(result.selectedResultStepId,p.steps.at(-1).stepId,'TEST_IR_SUPPORT_TERMINAL_ORACLE: '+p.operation+'/'+p.caseId);
   assert(result.observations.some(row=>row.op===p.operation),'TEST_IR_SUPPORT_EXECUTED_OPERATION_ORACLE: '+p.operation+'/'+p.caseId);
   cases.push({operation:p.operation,caseId:p.caseId,expected:{actual:p.expectedActual,determination:p.expectedDetermination},actual:plain(result.actual),determination:result.determination,result:'PASS'});
  }
  assert.equal(JSON.stringify({spec,canonicalBindings}),before,'TEST_IR_SUPPORT_INPUT_PRESERVATION_ORACLE: '+p.caseId);
  assert.deepEqual(cases.at(-1),expected,'TEST_IR_SUPPORT_CASE_POPULATION_ORACLE: '+p.caseId);
 }
 // Both expected digests are independently pinned from exact byte vectors,
 // and independently checked with node:crypto rather than runtime hashing.
 for(const p of supportPlans.filter(p=>p.operation==='HASH_SHA256'))assert.equal(sha(new Uint8Array(p.artifacts.VALUE.bytes)),p.expectedActual,'TEST_IR_SUPPORT_INDEPENDENT_HASH_ORACLE');
 return {schema:'closed-loop-test-ir-primitive-support-controls/1',result:'PASS',synthetic:true,actualBrowser:false,fullClauseProof:false,sourceSha256:Object.fromEntries(primitiveSupportSourceInputs.map(path=>[path,sha(path==='test-runtime.js'?runtimeSource:fs.readFileSync(new URL(path,import.meta.url)))])),cases};
}
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&isDeepStrictEqual(Object.keys(value).sort(),keys.slice().sort());
export function completePrimitiveSupport(value,report,operation){
 if(report?.verifyTestRuntimeV3!=='PASS'||!primitiveSupportOperations.includes(operation)||!exactKeys(value,['schema','result','synthetic','actualBrowser','fullClauseProof','sourceSha256','cases'])||value.schema!=='closed-loop-test-ir-primitive-support-controls/1'||value.result!=='PASS'||value.synthetic!==true||value.actualBrowser!==false||value.fullClauseProof!==false)return false;
 if(!exactKeys(value.sourceSha256,primitiveSupportSourceInputs)||!Object.values(value.sourceSha256).every(hash=>typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash))||value.sourceSha256['test-runtime.js']!==report.operationRegistryAdmission?.currentRuntimeSourceSha256||!isDeepStrictEqual(value.sourceSha256,primitiveSupportCurrentSourceHashes()))return false;
 if(!Array.isArray(value.cases)||value.cases.length!==primitiveSupportCaseOracles.length)return false;
 return primitiveSupportCaseOracles.every(expected=>{const rows=value.cases.filter(row=>row?.operation===expected.operation&&row?.caseId===expected.caseId);return rows.length===1&&isDeepStrictEqual(rows[0],expected);});
}
export function verifyPrimitiveSupportCatalogConsumers(catalog){
 const suite=catalog['verify-test-runtime-v3.mjs'],sources=primitiveSupportCurrentSourceHashes(),hash=sources['test-runtime.js'],value={schema:'closed-loop-test-ir-primitive-support-controls/1',result:'PASS',synthetic:true,actualBrowser:false,fullClauseProof:false,sourceSha256:sources,cases:structuredClone(primitiveSupportCaseOracles)},report={verifyTestRuntimeV3:'PASS',operationRegistryAdmission:{currentRuntimeSourceSha256:hash,primitiveSupportControls:value}},cases=[];
 for(const operation of primitiveSupportOperations){
  const id='test-ir.support.'+operation,checks=suite.checks.filter(row=>row.id===id);assert.equal(checks.length,1,'TEST_IR_SUPPORT_CATALOG_OWNER_ORACLE: '+operation);const check=checks[0],admit=r=>check.condition(r.operationRegistryAdmission?.primitiveSupportControls,r);
  assert.equal(check.marker,'verifyTestRuntimeV3');assert.equal(check.path,'operationRegistryAdmission.primitiveSupportControls');assert.equal(admit(report),true,'TEST_IR_SUPPORT_CONSUMER_VALID_ORACLE');
  const index=value.cases.findIndex(row=>row.operation===operation),faults=[['missing-group',r=>delete r.operationRegistryAdmission.primitiveSupportControls],['wrong-owner',r=>delete r.verifyTestRuntimeV3],['failed-owner',r=>r.verifyTestRuntimeV3='FAIL'],['missing-case',r=>r.operationRegistryAdmission.primitiveSupportControls.cases.splice(index,1)],['duplicate-case',r=>r.operationRegistryAdmission.primitiveSupportControls.cases.push(r.operationRegistryAdmission.primitiveSupportControls.cases[index])],['unknown-case',r=>r.operationRegistryAdmission.primitiveSupportControls.cases[index].caseId='UNKNOWN'],['changed-actual',r=>r.operationRegistryAdmission.primitiveSupportControls.cases[index].actual='WRONG'],['changed-determination',r=>r.operationRegistryAdmission.primitiveSupportControls.cases[index].determination='WRONG'],['changed-expected',r=>r.operationRegistryAdmission.primitiveSupportControls.cases[index].expected='WRONG'],['failed-case',r=>r.operationRegistryAdmission.primitiveSupportControls.cases[index].result='FAIL'],['browser-overclaim',r=>r.operationRegistryAdmission.primitiveSupportControls.actualBrowser=true],['full-clause-overclaim',r=>r.operationRegistryAdmission.primitiveSupportControls.fullClauseProof=true],['wrong-runtime-source',r=>r.operationRegistryAdmission.primitiveSupportControls.sourceSha256['test-runtime.js']='b'.repeat(64)],['extra-source',r=>r.operationRegistryAdmission.primitiveSupportControls.sourceSha256['unknown.js']=hash]];
  for(const input of primitiveSupportSourceInputs)faults.push(['missing-source:'+input,r=>delete r.operationRegistryAdmission.primitiveSupportControls.sourceSha256[input]],['malformed-source:'+input,r=>r.operationRegistryAdmission.primitiveSupportControls.sourceSha256[input]='bad'],['changed-valid-source:'+input,r=>r.operationRegistryAdmission.primitiveSupportControls.sourceSha256[input]=r.operationRegistryAdmission.primitiveSupportControls.sourceSha256[input]==='b'.repeat(64)?'c'.repeat(64):'b'.repeat(64)]);
  for(const[name,mutate]of faults){const bad=structuredClone(report);mutate(bad);assert.equal(admit(bad),false,'TEST_IR_SUPPORT_CONSUMER_REFUSAL_ORACLE: '+operation+'/'+name);cases.push(operation+'/'+name);}
  const reordered=structuredClone(report);reordered.operationRegistryAdmission.primitiveSupportControls.cases.reverse();assert.equal(admit(reordered),true,'TEST_IR_SUPPORT_CONSUMER_ORDER_EQUIVALENCE_ORACLE');
 }
 for(const suiteName of ['verify-test-runtime-v3.mjs','verify-final-acceptance.mjs'])for(const input of primitiveSupportSourceInputs)assert(catalog[suiteName].sourceInputs.includes(input),'TEST_IR_SUPPORT_SOURCE_CLOSURE_ORACLE: '+suiteName+'/'+input);
 const owner=fs.readFileSync(new URL('./test-runtime-operation-registry.mjs',import.meta.url),'utf8'),consumer=fs.readFileSync(new URL('./test-normative-catalog-consumers.mjs',import.meta.url),'utf8');
 assert.equal(owner.split('const primitiveSupportControls=await verifyPrimitiveSupportControls(runtime,source);').length,2,'TEST_IR_SUPPORT_DEFAULT_DISCOVERY_ORACLE');assert(owner.includes('primitiveSupportControls,ingestion,boundary:'));
 assert.equal(consumer.split('const primitiveSupportCatalogConsumers=verifyPrimitiveSupportCatalogConsumers(verificationCatalog);').length,2,'TEST_IR_SUPPORT_CONSUMER_DISCOVERY_ORACLE');assert(consumer.includes('primitiveSupportCatalogConsumers,testIrNativeCatalogConsumers,'));
 return {passed:true,cases,consumerOnly:true,actualProducerExecuted:false,eligibleReceiptCreated:false};
}
