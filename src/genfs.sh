#! /usr/bin/env sh

mkdir notes
cp _notes/*.md notes/

outfile='src/fs.js'

gen() {
	for file in $1; do
		if [ -d "$file" ]; then
			{
				echo "{ name: \"$file\","
				echo "parent: \"$(dirname "$file")\"," | sed 's/\./~/'
				echo "files: ["
				gen "$file/*"
				echo "]},";
			}
		else
			if [ "$file" != "$outfile" ]; then
				echo "{ name: \"$(basename "$file")\","
				printf 'data: `'
				while IFS= read -r line; do
					echo "$line" | sed 's/`/\\\`/g'
				done < "$file"
				echo '`},'
			fi
		fi
	done
}

{
	echo 'var fs = ['
	echo '{ name: "~", files: ['
	gen "notes"
	gen "*.md"
	printf ']}];'
} > $outfile

if command -v prettier > /dev/null; then
	prettier -w $outfile
fi

rm -rf notes
