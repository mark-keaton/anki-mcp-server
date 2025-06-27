# Anki MCP Server

An MCP server implementation that connects to a locally running Anki, providing card review and creation.

This server is designed to work with the [Anki desktop app](https://apps.ankiweb.net/) and the [Anki-Connect](https://foosoft.net/projects/anki-connect/) add-on.

Make sure you have the add-on installed before using.

## Resources
- **anki://search/deckcurrent**
  - Returns all cards from current deck
  - Equivalent of `deck:current` in Anki
- **anki://search/isdue**
  - Returns cards in review and learning waiting to be studied
  - Equivalent of `is:due` in Anki
- **anki://search/isnew**
  - Returns all unseen cards 
  - Equivalent of `is:new` in Anki

## Tools

### Card Management
- **update_cards**
  - Marks cards with given card IDs as answered and gives them an ease score between 1 (Again) and 4 (Easy)
  - Inputs:
    - `answers` (array): Array of objects with `cardId` (number) and `ease` (number) fields

- **add_card**
  - Creates a new card in the Default Anki deck
  - Inputs:
    - `front` (string): Front of card
    - `back` (string): Back of card

- **get_due_cards**
  - Returns n number of cards currently due for review
  - Inputs:
    - `num` (number): Number of cards

- **get_new_cards**
  - Returns n number of cards from new
  - Inputs:
    - `num` (number): Number of cards

### Deck Management
- **list_decks**
  - Get all deck names, optionally with IDs and basic statistics
  - Inputs:
    - `includeIds` (boolean, optional): Include deck IDs in the response
    - `includeStats` (boolean, optional): Include basic statistics (new, learning, review counts)

- **get_deck_info**
  - Get detailed information about a specific deck including statistics
  - Inputs:
    - `deckName` (string): Name of the deck to get information for
    - `includeStats` (boolean, optional): Include detailed statistics for the deck

- **get_deck_stats**
  - Get comprehensive statistics for one or more decks
  - Inputs:
    - `deckNames` (array, optional): Array of deck names to get statistics for
    - `deckName` (string, optional): Single deck name (alternative to deckNames array)

- **create_deck**
  - Create a new deck. Supports nested decks using '::' separator (e.g., 'Japanese::JLPT N5')
  - Inputs:
    - `deckName` (string): Name of the deck to create. Use '::' for nested decks (e.g., 'Parent::Child')

- **delete_deck**
  - Delete a deck and all its cards. Requires explicit confirmation for safety.
  - Inputs:
    - `deckName` (string): Name of the deck to delete
    - `confirmDelete` (boolean): Must be set to true to confirm deletion (safety check)

### Statistics & Analytics
- **get_collection_stats**
  - Get comprehensive statistics about your entire Anki collection
  - Inputs:
    - `includeHTML` (boolean, optional): Include raw HTML stats report from Anki

- **get_cards_reviewed_today**
  - Get the number of cards reviewed today
  - Inputs: None

- **get_review_history**
  - Get historical review data over a specified period
  - Inputs:
    - `days` (number, optional): Number of days to look back (default: 30, max: 365)

- **get_card_reviews**
  - Get detailed review history for specific cards
  - Inputs:
    - `cardIds` (array): Array of card IDs to get review history for

- **get_deck_performance**
  - Get performance analytics for specific decks including success rates and timing
  - Inputs:
    - `deckNames` (array, optional): Array of deck names to analyze
    - `deckName` (string, optional): Single deck name (alternative to deckNames array)
    - `days` (number, optional): Number of days to analyze (default: 30)

- **get_learning_stats**
  - Get learning progress analytics including graduation rates and retention
  - Inputs:
    - `deckName` (string, optional): Specific deck to analyze (optional, analyzes all decks if not provided)
    - `days` (number, optional): Number of days to analyze (default: 30)

### Note Management
- **find_notes**
  - Search for notes using advanced filters and queries (e.g., 'deck:Japanese tag:grammar', 'front:*kanji*')
  - Inputs:
    - `query` (string): Search query using Anki search syntax
    - `limit` (number, optional): Maximum number of results to return (default: 100, max: 1000)

- **get_note_info_detailed**
  - Get comprehensive information about specific notes including all fields, tags, and associated cards
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to get information for
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)

- **update_note_fields**
  - Update fields in existing notes. Preserves HTML formatting and card scheduling.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to update
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `fields` (object): Object with field names as keys and new values as values

- **delete_notes**
  - Delete notes and all associated cards. Requires explicit confirmation for safety.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to delete
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `confirmDelete` (boolean): Must be set to true to confirm deletion (safety check)

- **add_tags_to_notes**
  - Add tags to existing notes. Creates new tags automatically if they don't exist.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to add tags to
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `tags` (array): Array of tags to add

- **remove_tags_from_notes**
  - Remove specific tags from notes. Does not delete the tags entirely, just removes them from specified notes.
  - Inputs:
    - `noteIds` (array, optional): Array of note IDs to remove tags from
    - `noteId` (number, optional): Single note ID (alternative to noteIds array)
    - `tags` (array): Array of tags to remove

- **get_all_tags**
  - Get all tags in the collection with optional usage statistics
  - Inputs:
    - `includeUsage` (boolean, optional): Include count of how many notes use each tag

- **duplicate_note**
  - Create a copy of an existing note, optionally modifying fields and changing deck
  - Inputs:
    - `noteId` (number): ID of the note to duplicate
    - `targetDeck` (string, optional): Deck to create the duplicate in
    - `fieldUpdates` (object, optional): Fields to modify in the duplicate
    - `additionalTags` (array, optional): Additional tags to add to the duplicate

### Advanced Card Management
- **find_cards_advanced**
  - Search for cards using advanced filters including ease factors, intervals, and scheduling
  - Inputs:
    - `query` (string): Advanced search query using Anki search syntax with properties
    - `limit` (number, optional): Maximum number of results to return (default: 100, max: 1000)

- **get_card_info_detailed**
  - Get comprehensive information about specific cards including ease factors, intervals, lapses, and scheduling details
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to get detailed information for
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)

- **suspend_cards**
  - Suspend or unsuspend cards to control their review scheduling. Suspended cards won't appear in reviews.
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to suspend or unsuspend
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)
    - `suspend` (boolean): true to suspend cards, false to unsuspend cards

- **set_card_due_date**
  - Reschedule cards to specific due dates. Useful for managing review timing and catching up on overdue cards.
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to reschedule
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)
    - `days` (string): Due date specification ('0' = today, '1' = tomorrow, '3-7' = random 3-7 days)

- **forget_cards**
  - Reset card progress to 'new' status, removing all review history. Requires explicit confirmation for safety.
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to reset
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)
    - `confirmReset` (boolean): Must be set to true to confirm resetting card progress (safety check)

- **set_card_ease_factors**
  - Adjust ease factors for cards to make them easier or harder. Higher ease = longer intervals.
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to adjust
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)
    - `easeFactors` (array, optional): Array of ease factors (one per card, typically 1300-4000)
    - `easeFactor` (number, optional): Single ease factor to apply to all cards

- **get_card_intervals**
  - Get interval information for cards including current intervals and historical progression
  - Inputs:
    - `cardIds` (array, optional): Array of card IDs to analyze
    - `cardId` (number, optional): Single card ID (alternative to cardIds array)
    - `includeHistory` (boolean, optional): Include complete interval history for each card

### Model/Template Management
- **list_models**
  - Get all note types/models in the collection with optional detailed information
  - Inputs:
    - `includeDetails` (boolean, optional): Include detailed model information including fields and templates

- **get_model_info**
  - Get comprehensive information about specific models including fields, templates, and styling
  - Inputs:
    - `modelNames` (array, optional): Array of model names to get information for
    - `modelName` (string, optional): Single model name (alternative to modelNames array)

- **get_model_fields**
  - Get field definitions and properties for specific models
  - Inputs:
    - `modelNames` (array, optional): Array of model names to get field information for
    - `modelName` (string, optional): Single model name (alternative to modelNames array)
    - `includeProperties` (boolean, optional): Include detailed field properties like fonts and sizes

- **create_model**
  - Create a new note type with custom fields and templates. Supports both basic and cloze deletion models.
  - Inputs:
    - `modelName` (string): Name for the new model (must be unique)
    - `fields` (array): Array of field names for the model
    - `templates` (array): Array of card templates with name, front, and back properties
    - `css` (string, optional): CSS styling for the model
    - `isCloze` (boolean, optional): Create as cloze deletion model

- **update_model_templates**
  - Update card templates and styling for existing models
  - Inputs:
    - `modelName` (string): Name of the model to update
    - `templates` (object, optional): Templates to update with template names as keys
    - `css` (string, optional): New CSS styling for the model

### System & Utility
- **get_profiles**
  - Get all available Anki profiles on the system
  - Inputs: None

- **get_active_profile**
  - Get information about the currently active Anki profile
  - Inputs: None

- **switch_profile**
  - Switch to a different Anki profile. This will change the active profile and reload the collection.
  - Inputs:
    - `profileName` (string): Name of the profile to switch to

- **sync_collection**
  - Sync the collection with AnkiWeb. Requires AnkiWeb account setup in Anki.
  - Inputs:
    - `forceSync` (boolean, optional): Force sync even if no changes detected

- **export_deck**
  - Export a deck to an .apkg file for backup or sharing
  - Inputs:
    - `deckName` (string): Name of the deck to export
    - `filePath` (string): Path where to save the .apkg file (should end with .apkg)
    - `includeScheduling` (boolean, optional): Include scheduling information in export

- **reload_collection**
  - Reload the collection to refresh data after external changes
  - Inputs: None

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Configuration 

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anki-mcp-server": {
      "command": "/path/to/anki-mcp-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
