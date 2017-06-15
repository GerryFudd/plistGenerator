// This pegjs file was patterned after the one that was built for the node-xcode
//  project (https://github.com/alunny/node-xcode).  It has been modified so
//  that the resulting parsed object is in the same format that is used by
//  the plist project (https://github.com/TooTallNate/plist.js).
{
    function merge(hash, secondHash) {
        secondHash = secondHash[0]
        for(var i in secondHash) {
       		hash[i] = merge_obj(hash[i], secondHash[i]);
        }

        return hash;
    }

    function merge_obj(obj, secondObj) {
    	if (!obj)
    		return secondObj;

        for(var i in secondObj)
            obj[i] = merge_obj(obj[i], secondObj[i]);

        return obj;
    }
}

/*
 *  Project: point of entry from pbxproj file
 */
Project
  = headComment:SingleLineComment? InlineComment? _ obj:Object NewLine _
    {
        return obj;
    }

/*
 *  Object: basic hash data structure with Assignments
 */
Object
  = "{" obj:(AssignmentList / EmptyBody) "}"
    { return Object.assign({}, obj) }

EmptyBody
  = _
    { return Object.create(null) }

AssignmentList
  = _ head:Assignment _ tail:AssignmentList* _
    {
      if (tail) return merge(head,tail)
      else return head
    }
    / _ head:DelimitedSection _ tail:AssignmentList*
    {
      if (tail) return merge(head,tail)
      else return head
    }

/*
 *  Assignments
 *  can be simple "key = value"
 *  or commented "key /* real key * / = value"
 */
Assignment
  = SimpleAssignment / CommentedAssignment

SimpleAssignment
  = id:Identifier _ "=" _ val:Value ";"
    {
      var result = Object.create(null);
      var value;
      if (val === 'NO') {
        value = false;
      } else if (val === 'YES') {
        value = true;
      } else if (val === 'undefined') {
        value = undefined;
      } else if (typeof val === 'number') {
        value = val + '';
      } else {
        value = val;
      }
      result[id] = value
      return result
    }

CommentedAssignment
  = commentedId:CommentedIdentifier _ "=" _ val:Value ";"
    {
        var result = Object.create(null);
        var value;
        if (val === 'NO') {
          value = false;
        } else if (val === 'YES') {
          value = true;
        } else if (val === 'undefined') {
          value = undefined;
        } else if (typeof val === 'number') {
          value = val + '';
        } else {
          value = val;
        }

        result[commentedId.id] = value;
        return result;

    }
    /
    id:Identifier _ "=" _ commentedVal:CommentedValue ";"
    {
        var result = Object.create(null);
        var value;
        if (commentedVal.value === 'NO') {
          value = false;
        } else if (commentedVal.value === 'YES') {
          value = true;
        } else if (commentedVal.value === 'undefined') {
          value = undefined;
        } else if (typeof commentedVal.value === 'number') {
          value = commentedVal.value + '';
        } else {
          value = commentedVal.value;
        }

        result[id] = value;
        return result;
    }

CommentedIdentifier
  = id:Identifier _ comment:InlineComment
    {
        var result = Object.create(null);
        result.id = id;
        return result
    }

CommentedValue
  = literal:Value _ comment:InlineComment
    {
        var result = Object.create(null)
        result.value = literal.trim();
        return result;
    }

InlineComment
  = InlineCommentOpen body:[^*]+ InlineCommentClose
    { return body.join('') }

InlineCommentOpen
  = "/*"

InlineCommentClose
  = "*/"

/*
 *  DelimitedSection - ad hoc project structure pbxproj files use
 */
DelimitedSection
  = begin:DelimitedSectionBegin _ fields:(AssignmentList / EmptyBody) _ DelimitedSectionEnd
    {
        return fields
    }

DelimitedSectionBegin
  = "/* Begin " sectionName:Identifier " section */" NewLine
    { return { name: sectionName } }

DelimitedSectionEnd
  = "/* End " sectionName:Identifier " section */" NewLine
    { return { name: sectionName } }

/*
 * Arrays: lists of values, possible wth comments
 */
Array
  = "(" arr:(ArrayBody / EmptyArray ) ")" { return arr }

EmptyArray
  = _ { return [] }

ArrayBody
  = _ head:ArrayEntry _ tail:ArrayBody? _
    {
        if (tail) {
            tail.unshift(head);
            return tail;
        } else {
            return [head];
        }
    }

ArrayEntry
  = SimpleArrayEntry / CommentedArrayEntry

SimpleArrayEntry
  = val:Value EndArrayEntry { return val }

CommentedArrayEntry
  = val:Value _ comment:InlineComment EndArrayEntry
    {
        return val;
    }

EndArrayEntry
  = "," / _ &")"

/*
 *  Identifiers and Values
 */
Identifier
  = id:[A-Za-z0-9_]+ { return id.join('').trim() }
  / QuotedString

Value
  = Object / Array / NumberValue / StringValue

NumberValue
  = DecimalValue / IntegerValue

DecimalValue
  = decimal:(IntegerValue "." IntegerValue)
    {
        // store decimals as strings
        // as JS doesn't differentiate bw strings and numbers
        return decimal.join('')
    }

IntegerValue
  = !Alpha number:Digit+ !NonTerminator
    { return parseInt(number.join(''), 10) }

StringValue
 = QuotedString / LiteralString

QuotedString
 = DoubleQuote str:QuotedBody DoubleQuote { return '"' + str + '"' }

QuotedBody
 = str:NonQuote+ { return str.join('').trim() }

NonQuote
  = EscapedQuote / !DoubleQuote char:. { return char }

EscapedQuote
  = "\\" DoubleQuote { return '\\"' }

LiteralString
  = literal:LiteralChar+ { return literal.join('').trim() }

LiteralChar
  = !InlineCommentOpen !LineTerminator char:NonTerminator
    { return char }

NonTerminator
  = [^;,\n]

/*
 * SingleLineComment - used for the encoding comment
 */
SingleLineComment
  = "//" _ contents:OneLineString NewLine
    { return contents }

OneLineString
  = contents:NonLine*
    { return contents.join('') }

/*
 *  Simple character checking rules
 */
Digit
  = [0-9]

Alpha
  = [A-Za-z]

DoubleQuote
  = '"'

_ "whitespace"
  = whitespace*

whitespace
  = NewLine / [\t ]

NonLine
  = !NewLine char:Char
    { return char }

LineTerminator
  = NewLine / ";"

NewLine
    = [\n\r]

Char
  = .
