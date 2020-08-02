import { Octokit } from "@octokit/rest"

const octokit = new Octokit();
async function main() {
  await test2();
}


main()


async function test2() {
  const { data } = await octokit.users.getByUsername({username: 'cancerberosgx'})
  // const { data } = await octokit.pulls.list({owner: 'cancerberosgx', repo: 'emscripten'})
  console.log(data);
}


async function test1() {
  const { data } = await octokit.repos
    .listForOrg({
      org: "octokit",
      type: "public",
    });
  console.log(data);
}
